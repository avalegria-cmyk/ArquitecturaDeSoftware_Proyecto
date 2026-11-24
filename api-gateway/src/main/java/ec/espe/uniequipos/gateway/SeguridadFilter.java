package ec.espe.uniequipos.gateway;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

/**
 * Filtro global del API Gateway. Centraliza lo que antes hacía cada ruta del monolito:
 * identificador de correlación y registro (logging), bloqueo de rutas internas,
 * validación de origen, límite de intentos de login (control de tráfico) y autenticación.
 * Los microservicios reciben la identidad ya validada en las cabeceras X-User-*,
 * firmadas con X-Internal-Token para que nadie externo pueda falsificarlas.
 */
@Component
public class SeguridadFilter implements GlobalFilter, Ordered {

	private static final Logger log = LoggerFactory.getLogger(SeguridadFilter.class);
	private static final Set<String> PUBLICAS = Set.of("/api/health", "/api/auth/login", "/api/auth/logout");
	private static final Set<String> LIMITADAS = Set.of("/api/auth/login", "/api/auth/password");
	private static final Set<String> CABECERAS_INTERNAS = Set.of(
			"X-User-Id", "X-User-Role", "X-User-Name", "X-User-Email", "X-Internal-Token");

	private final WebClient http = WebClient.create();
	private final Map<String, Cubeta> intentos = new ConcurrentHashMap<>();
	private final String authUrl;
	private final String internalToken;
	private final String appOrigin;

	public SeguridadFilter(
			@Value("${uniequipos.auth-url:}") String authUrl,
			@Value("${uniequipos.internal-token}") String internalToken,
			@Value("${uniequipos.app-origin:http://localhost:8088}") String appOrigin) {
		this.authUrl = authUrl;
		this.internalToken = internalToken;
		this.appOrigin = appOrigin;
	}

	@Override
	public int getOrder() {
		return -100;
	}

	@Override
	public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
		long inicio = System.nanoTime();
		ServerHttpRequest request = exchange.getRequest();
		String path = request.getPath().value();
		HttpMethod method = request.getMethod();
		String correlacion = request.getHeaders().getFirst("X-Correlation-Id");
		String id = correlacion == null || correlacion.isBlank() ? UUID.randomUUID().toString() : correlacion;
		exchange.getResponse().getHeaders().set("X-Correlation-Id", id);

		Mono<Void> resultado;
		if (path.startsWith("/internal")) {
			resultado = json(exchange, HttpStatus.NOT_FOUND, "Ruta no encontrada.");
		} else if (HttpMethod.POST.equals(method) && !origenPermitido(request)) {
			resultado = json(exchange, HttpStatus.FORBIDDEN, "Origen o formato de solicitud no permitido.");
		} else if (HttpMethod.POST.equals(method) && LIMITADAS.contains(path) && !permitirIntento(ip(request))) {
			resultado = json(exchange, HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos. Espera un minuto y vuelve a intentar.");
		} else if (authUrl.isBlank() || PUBLICAS.contains(path) || !path.startsWith("/api/")) {
			resultado = chain.filter(conIdentidad(exchange, id, null));
		} else {
			resultado = verificarSesion(request).flatMap(usuario -> usuario.isEmpty()
					? json(exchange, HttpStatus.UNAUTHORIZED, "La sesión terminó. Inicia sesión nuevamente.")
					: chain.filter(conIdentidad(exchange, id, usuario)))
					.onErrorResume(error -> {
						log.warn("Servicio de identidad no disponible: {}", error.getMessage());
						return json(exchange, HttpStatus.SERVICE_UNAVAILABLE, "No se pudo verificar la sesión. Intenta nuevamente.");
					});
		}
		return resultado.doFinally(señal -> log.info("{} {} -> {} ({} ms) correlacion={}", method, path,
				exchange.getResponse().getStatusCode(), (System.nanoTime() - inicio) / 1_000_000, id));
	}

	/** Pregunta al servicio de Identidad quién es el dueño de la cookie de sesión. */
	@SuppressWarnings("unchecked")
	private Mono<Map<String, Object>> verificarSesion(ServerHttpRequest request) {
		HttpCookie cookie = request.getCookies().getFirst("uni_session");
		if (cookie == null || cookie.getValue().isBlank()) {
			return Mono.just(Map.of());
		}
		return http.get().uri(authUrl)
				.header("Cookie", "uni_session=" + cookie.getValue())
				.header("X-Internal-Token", internalToken)
				.exchangeToMono(respuesta -> respuesta.statusCode().is2xxSuccessful()
						? respuesta.bodyToMono(Map.class)
						: respuesta.releaseBody().thenReturn(Map.of()))
				.timeout(Duration.ofSeconds(5))
				.map(cuerpo -> cuerpo.get("user") instanceof Map<?, ?> user ? (Map<String, Object>) user : Map.of());
	}

	/** Quita cualquier cabecera interna enviada por el cliente y agrega las verdaderas. */
	private ServerWebExchange conIdentidad(ServerWebExchange exchange, String correlacion, Map<String, Object> usuario) {
		ServerHttpRequest request = exchange.getRequest().mutate().headers(h -> {
			CABECERAS_INTERNAS.forEach(h::remove);
			h.set("X-Internal-Token", internalToken);
			h.set("X-Correlation-Id", correlacion);
			if (usuario != null) {
				h.set("X-User-Id", String.valueOf(usuario.get("id")));
				h.set("X-User-Role", String.valueOf(usuario.get("role")));
				h.set("X-User-Name", codificar(usuario.get("name")));
				h.set("X-User-Email", codificar(usuario.get("email")));
			}
		}).build();
		return exchange.mutate().request(request).build();
	}

	private static String codificar(Object valor) {
		return URLEncoder.encode(String.valueOf(valor), StandardCharsets.UTF_8).replace("+", "%20");
	}

	/** Misma regla del monolito: solo JSON, cabecera propia y origen de la aplicación (o su alias local). */
	private boolean origenPermitido(ServerHttpRequest request) {
		String origin = request.getHeaders().getOrigin();
		String tipo = request.getHeaders().getFirst("Content-Type");
		boolean origen = origin == null || origin.isEmpty() || origin.equals(appOrigin)
				|| origin.equals(appOrigin.replace("://localhost", "://127.0.0.1"))
				|| origin.equals(appOrigin.replace("://127.0.0.1", "://localhost"));
		return origen && "UniEquipos".equals(request.getHeaders().getFirst("X-Requested-With"))
				&& tipo != null && tipo.startsWith(MediaType.APPLICATION_JSON_VALUE);
	}

	private String ip(ServerHttpRequest request) {
		String real = request.getHeaders().getFirst("X-Real-IP");
		if (real != null && !real.isBlank()) return real;
		return request.getRemoteAddress() == null ? "desconocida" : request.getRemoteAddress().getAddress().getHostAddress();
	}

	/** Token bucket: 20 intentos de golpe y luego 10 por minuto por IP. */
	private boolean permitirIntento(String ip) {
		if (intentos.size() > 10_000) intentos.clear();
		return intentos.computeIfAbsent(ip, clave -> new Cubeta()).tomar();
	}

	private Mono<Void> json(ServerWebExchange exchange, HttpStatus status, String mensaje) {
		ServerHttpResponse response = exchange.getResponse();
		response.setStatusCode(status);
		response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
		response.getHeaders().setCacheControl("no-store");
		byte[] cuerpo = ("{\"message\":\"" + mensaje + "\"}").getBytes(StandardCharsets.UTF_8);
		return response.writeWith(Mono.just(response.bufferFactory().wrap(cuerpo)));
	}

	private static final class Cubeta {
		private static final double CAPACIDAD = 20;
		private static final double POR_NANO = 10.0 / 60_000_000_000L;
		private double fichas = CAPACIDAD;
		private long ultimo = System.nanoTime();

		synchronized boolean tomar() {
			long ahora = System.nanoTime();
			fichas = Math.min(CAPACIDAD, fichas + (ahora - ultimo) * POR_NANO);
			ultimo = ahora;
			if (fichas < 1) return false;
			fichas -= 1;
			return true;
		}
	}

}
