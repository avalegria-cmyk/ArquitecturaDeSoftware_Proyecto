// Servicio de Notificaciones de UniEquipos.
// Mantiene abiertas las conexiones SSE de los navegadores y les avisa cuando
// otro microservicio informa un cambio. No guarda datos (es stateless).
package main

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// Hub reparte cada aviso a todos los navegadores conectados.
type Hub struct {
	mu       sync.Mutex
	clientes map[chan string]struct{}
	revision int64
	inicio   int64
}

func NuevoHub() *Hub {
	return &Hub{clientes: map[chan string]struct{}{}, inicio: time.Now().Unix()}
}

func (h *Hub) Revision() string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return fmt.Sprintf("%d:%d", h.inicio, h.revision)
}

func (h *Hub) Suscribir() chan string {
	canal := make(chan string, 8)
	h.mu.Lock()
	h.clientes[canal] = struct{}{}
	h.mu.Unlock()
	return canal
}

func (h *Hub) Cancelar(canal chan string) {
	h.mu.Lock()
	delete(h.clientes, canal)
	h.mu.Unlock()
}

// Publicar incrementa la revisión y avisa sin bloquearse si un cliente va lento.
func (h *Hub) Publicar() string {
	h.mu.Lock()
	h.revision++
	rev := fmt.Sprintf("%d:%d", h.inicio, h.revision)
	for canal := range h.clientes {
		select {
		case canal <- rev:
		default:
		}
	}
	total := len(h.clientes)
	h.mu.Unlock()
	log.Printf("cambio publicado revision=%s navegadores=%d", rev, total)
	return rev
}

func (h *Hub) Conectados() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clientes)
}

type Servidor struct {
	hub   *Hub
	token string
}

// interno comprueba que la petición venga del gateway o de otro microservicio.
func (s *Servidor) interno(r *http.Request) bool {
	recibido := r.Header.Get("X-Internal-Token")
	return s.token != "" && subtle.ConstantTimeCompare([]byte(recibido), []byte(s.token)) == 1
}

func responder(w http.ResponseWriter, status int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(cuerpo)
}

// GET /api/events: flujo SSE. El gateway ya validó la sesión y envía X-User-Id.
func (s *Servidor) eventos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		responder(w, http.StatusMethodNotAllowed, map[string]string{"message": "Método no permitido."})
		return
	}
	if !s.interno(r) || r.Header.Get("X-User-Id") == "" {
		responder(w, http.StatusUnauthorized, map[string]string{"message": "La sesión terminó. Inicia sesión nuevamente."})
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		responder(w, http.StatusInternalServerError, map[string]string{"message": "Streaming no soportado."})
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "private, no-cache, no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	canal := s.hub.Suscribir()
	defer s.hub.Cancelar(canal)

	// No se envían datos personales: solo el aviso de que algo cambió.
	fmt.Fprintf(w, "retry: 3000\n\nid: %s\nevent: sync\ndata: {}\n\n", s.hub.Revision())
	flusher.Flush()

	latido := time.NewTicker(15 * time.Second)
	defer latido.Stop()
	// Se cierra cada minuto para que el navegador reconecte y el gateway vuelva a validar la sesión.
	limite := time.NewTimer(60 * time.Second)
	defer limite.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case rev := <-canal:
			fmt.Fprintf(w, "id: %s\nevent: change\ndata: {}\n\n", rev)
			flusher.Flush()
		case <-latido.C:
			fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		case <-limite.C:
			return
		}
	}
}

// POST /internal/events: otro microservicio avisa que cambió algo.
func (s *Servidor) publicar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		responder(w, http.StatusMethodNotAllowed, map[string]string{"message": "Método no permitido."})
		return
	}
	if !s.interno(r) {
		responder(w, http.StatusForbidden, map[string]string{"message": "Acceso interno no autorizado."})
		return
	}
	var evento struct {
		Type string `json:"type"`
	}
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&evento)
	log.Printf("evento recibido tipo=%q origen=%s", evento.Type, r.Header.Get("X-Service"))
	responder(w, http.StatusAccepted, map[string]string{"revision": s.hub.Publicar()})
}

func (s *Servidor) salud(w http.ResponseWriter, r *http.Request) {
	responder(w, http.StatusOK, map[string]any{"status": "ok", "service": "notificaciones", "connected": s.hub.Conectados()})
}

func main() {
	puerto := os.Getenv("PORT")
	if puerto == "" {
		puerto = "3007"
	}
	s := &Servidor{hub: NuevoHub(), token: os.Getenv("INTERNAL_TOKEN")}
	if s.token == "" {
		log.Fatal("Configura INTERNAL_TOKEN.")
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/events", s.eventos)
	mux.HandleFunc("/internal/events", s.publicar)
	mux.HandleFunc("/health", s.salud)
	log.Printf("Servicio de notificaciones escuchando en :%s", puerto)
	servidor := &http.Server{Addr: ":" + puerto, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(servidor.ListenAndServe())
}
