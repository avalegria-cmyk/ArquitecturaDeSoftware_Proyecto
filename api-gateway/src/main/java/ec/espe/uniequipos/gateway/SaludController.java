package ec.espe.uniequipos.gateway;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * GET /api/health: el gateway agrega en una sola respuesta el estado de todos
 * los microservicios (patrón de agregación del API Gateway).
 */
@RestController
@EnableConfigurationProperties(SaludController.Servicios.class)
public class SaludController {

	@ConfigurationProperties(prefix = "uniequipos")
	public record Servicios(Map<String, String> servicios) {
	}

	private final WebClient http = WebClient.create();
	private final Map<String, String> servicios;

	public SaludController(Servicios config) {
		this.servicios = new TreeMap<>(config.servicios());
	}

	@GetMapping("/api/health")
	public Mono<ResponseEntity<Map<String, Object>>> salud() {
		return Flux.fromIterable(servicios.entrySet())
				.flatMap(s -> http.get().uri(s.getValue() + "/health").retrieve().toBodilessEntity()
						.map(r -> Map.entry(s.getKey(), "ok"))
						.timeout(Duration.ofSeconds(2))
						.onErrorReturn(Map.entry(s.getKey(), "caido")))
				.collectMap(Map.Entry::getKey, Map.Entry::getValue, TreeMap::new)
				.map(estados -> {
					boolean todos = estados.values().stream().allMatch("ok"::equals);
					Map<String, Object> cuerpo = new LinkedHashMap<>();
					cuerpo.put("status", todos ? "ok" : "degradado");
					cuerpo.put("services", estados);
					return ResponseEntity.status(todos ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(cuerpo);
				});
	}

}
