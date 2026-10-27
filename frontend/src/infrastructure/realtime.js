// Una conexión SSE por sesión de la aplicación; las vistas conservan sus permisos HTTP.
export function subscribeChanges(onChange, onStatus) {
  const source = new EventSource("/api/events");
  let closed = false;
  source.onopen = () => onStatus("connected");
  const sync = () => {
    onStatus("connected");
    onChange();
  };
  source.addEventListener("sync", sync);
  source.addEventListener("change", sync);
  source.addEventListener("reconnect", () => onStatus("reconnecting"));
  source.addEventListener("session-expired", () => {
    closed = true;
    source.close();
    window.dispatchEvent(new Event("session-expired"));
  });
  source.onerror = () => {
    if (closed) return;
    onStatus("reconnecting");
    // EventSource no expone el 401 de una conexión que ya comienza expirada.
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => {
        if (!closed && response.status === 401) {
          closed = true;
          source.close();
          window.dispatchEvent(new Event("session-expired"));
        }
      })
      .catch(() => {});
  };
  return () => {
    closed = true;
    source.close();
  };
}
