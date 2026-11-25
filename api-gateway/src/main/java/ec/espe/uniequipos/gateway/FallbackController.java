package ec.espe.uniequipos.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Respuesta del Circuit Breaker: cuando un microservicio no responde,
 * el gateway devuelve un 503 claro en lugar de dejar esperando al navegador.
 */
@RestController
public class FallbackController {

	@RequestMapping("/fallback")
	public ResponseEntity<String> fallback() {
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
				.contentType(MediaType.APPLICATION_JSON)
				.body("{\"message\":\"El servicio no está disponible. Intenta nuevamente en unos segundos.\"}");
	}

}
