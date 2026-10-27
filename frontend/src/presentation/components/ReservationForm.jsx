import { useRealtimeRevision } from "./RealtimeContext.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Search,
  Send,
  LoaderCircle,
  Check,
  Cpu,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Modal } from "./Modal.jsx";
import {
  campusNowInput,
  intervalError,
  durationLabel,
  searchReservableEquipment,
} from "../../application/reservations.js";

export function ReservationForm({ api, user, onClose, onCreated }) {
  const liveRevision = useRealtimeRevision();
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [search, setSearch] = useState(""),
    [selectedId, setSelectedId] = useState(null);
  const [teacherId, setTeacherId] = useState(""),
    [purpose, setPurpose] = useState("");
  const [teachers, setTeachers] = useState([]),
    [teacherLoading, setTeacherLoading] = useState(true),
    [teacherError, setTeacherError] = useState("");
  const [availability, setAvailability] = useState({
    key: null,
    items: [],
    error: "",
    checked: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [sending, setSending] = useState(false);
  const requestRef = useRef(null);
  const invalid = intervalError(start, end);
  const key = `${start}|${end}|${revision}`;
  const matching = availability.key === key;
  const ready =
    matching && !availability.error && availability.checked && !invalid;
  const items = matching ? availability.items : [];
  const filtered = useMemo(
    () => searchReservableEquipment(items, search),
    [items, search],
  );
  const selected = ready ? items.find((e) => e.id === selectedId) : null;
  const isLoading = !matching && !(start || end ? invalid : false);

  useEffect(() => {
    let active = true;
    setTeacherLoading(true);
    setTeacherError("");
    api
      .responsibleTeachers()
      .then((r) => {
        if (active) setTeachers(r.teachers);
      })
      .catch((e) => {
        if (active) setTeacherError(e.message);
      })
      .finally(() => {
        if (active) setTeacherLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, revision, liveRevision]);

  useEffect(() => {
    let active = true;
    if ((start || end) && invalid)
      return () => {
        active = false;
      };
    api
      .availability(start && end ? { startsAt: start, endsAt: end } : {})
      .then((r) => {
        if (!active) return;
        setAvailability({
          key,
          items: r.equipment,
          checked: r.intervalChecked,
          error: "",
        });
        setSelectedId((current) =>
          r.equipment.some((e) => e.id === current) ? current : null,
        );
      })
      .catch((e) => {
        if (active)
          setAvailability({ key, items: [], checked: false, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [api, start, end, key, invalid, liveRevision]);

  function changeDate(setter, value) {
    setter(value);
    setSelectedId(null);
    setError("");
  }
  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    const dateError = intervalError(start, end);
    if (dateError) {
      setError(dateError);
      return;
    }
    if (!selected) {
      setError("Selecciona un equipo disponible para las fechas indicadas.");
      return;
    }
    if (!teacherId) {
      setError("Selecciona el docente responsable.");
      return;
    }
    const payload = {
      equipmentId: selected.id,
      teacherId: Number(teacherId),
      startsAt: start,
      endsAt: end,
      purpose: purpose.trim(),
    };
    const signature = JSON.stringify(payload);
    if (requestRef.current?.signature !== signature)
      requestRef.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setSending(true);
    setError("");
    try {
      const result = await api.createReservation({
        ...payload,
        requestKey: requestRef.current.key,
      });
      onCreated(result.reservation);
    } catch (e) {
      setError(e.message);
      if (e.status === 409) {
        setSelectedId(null);
        setRevision((v) => v + 1);
        requestRef.current = null;
      }
      setBusy(false);
      setSending(false);
    }
  }
  return (
    <Modal
      title="Realizar nueva reserva"
      subtitle="Selecciona un equipo, define el período y asigna el docente responsable."
      onClose={onClose}
      busy={busy}
      wide
    >
      <form onSubmit={submit}>
        <fieldset className="form-fields" disabled={busy}>
          <div className="reservation-applicant">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <small>Solicitante</small>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <section className="reservation-section">
            <h3>
              <CalendarDays size={18} /> 1. Fechas del préstamo
            </h3>
            <div className="form-grid">
              <label>
                Inicio
                <input
                  type="datetime-local"
                  value={start}
                  min={campusNowInput()}
                  onChange={(e) => changeDate(setStart, e.target.value)}
                  required
                />
              </label>
              <label>
                Devolución prevista
                <input
                  type="datetime-local"
                  value={end}
                  min={start || campusNowInput()}
                  onChange={(e) => changeDate(setEnd, e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="form-hint">
              Hora de Ecuador (America/Guayaquil).{" "}
              {start && end && !invalid
                ? `Duración: ${durationLabel(start, end)}.`
                : "Selecciona ambas fechas para consultar disponibilidad por horario."}
            </p>
            {(start || end) && invalid && (
              <p className="inline-warning" role="status">
                {invalid}
              </p>
            )}
          </section>
          <section className="reservation-section">
            <h3>
              <Cpu size={18} /> 2. Elige un equipo
            </h3>
            <label
              className="reservation-search-label"
              htmlFor="reserve-search"
            >
              Buscar por tipo, nombre o código
            </label>
            <div className="search">
              <Search size={18} />
              <input
                id="reserve-search"
                type="search"
                list="reserve-categories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escribe IoT, laptop, proyector…"
              />
              <datalist id="reserve-categories">
                {[...new Set(items.map((e) => e.category))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {!start && !end && (
              <p className="form-hint">
                Estos equipos están habilitados. Define las fechas para saber
                cuáles puedes reservar.
              </p>
            )}
            {isLoading && (
              <div className="availability-message" role="status">
                <LoaderCircle className="spin" size={19} /> Consultando
                disponibilidad…
              </div>
            )}
            {matching && availability.error && (
              <div className="error" role="alert">
                {availability.error}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  <RefreshCw size={15} /> Reintentar
                </button>
              </div>
            )}
            {matching && !availability.error && (
              <>
                <p className="form-hint" aria-live="polite">
                  {filtered.length}{" "}
                  {ready
                    ? "equipos disponibles en este horario"
                    : "equipos habilitados"}
                  {search ? ` para “${search}”` : ""}.
                </p>
                <div className="reservation-equipment-grid">
                  {filtered.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={!ready}
                      aria-pressed={selectedId === item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setError("");
                      }}
                      className={`reserve-equipment ${selectedId === item.id ? "selected" : ""}`}
                    >
                      <div className="reserve-card-top">
                        <span className="pill">{item.category}</span>
                        <span className="selection-circle">
                          {selectedId === item.id && <Check size={13} />}
                        </span>
                      </div>
                      <strong>{item.name}</strong>
                      <span className="reserve-code">{item.code}</span>
                      <small>
                        <MapPin size={13} />
                        {item.location}
                      </small>
                      <span className="status disponible">
                        {ready
                          ? "Disponible en este horario"
                          : "Define fechas para seleccionar"}
                      </span>
                    </button>
                  ))}
                </div>
                {!filtered.length && (
                  <div className="availability-message">
                    No hay equipos disponibles con estos filtros. Cambia la
                    búsqueda o las fechas.
                  </div>
                )}
              </>
            )}
            {selected && (
              <p className="selected-equipment-summary">
                <Check size={15} /> Seleccionado: {selected.name} ·{" "}
                {selected.code}
              </p>
            )}
          </section>
          <section className="reservation-section">
            <h3>3. Responsable y motivo</h3>
            <label>
              Docente responsable
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                disabled={teacherLoading || busy}
                required
              >
                <option value="">
                  {teacherLoading
                    ? "Cargando docentes…"
                    : "Selecciona un docente"}
                </option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {teacherError && (
              <div className="error" role="alert">
                {teacherError}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Reintentar
                </button>
              </div>
            )}
            {!teacherLoading && !teacherError && !teachers.length && (
              <p className="inline-warning">
                No hay docentes activos. Solicita al administrador registrar
                uno.
              </p>
            )}
            <label>
              Motivo o actividad académica
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                maxLength={1000}
                rows={3}
                required
                placeholder="Describe para qué actividad necesitas el equipo."
              />
            </label>
          </section>
          <p className="reservation-policy">
            La solicitud se registrará <strong>En revisión</strong> y ocupará
            provisionalmente el horario. El equipo se valida nuevamente al
            enviar. El préstamo requiere completar las aprobaciones.
          </p>
        </fieldset>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <footer className="dialog-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !selected ||
              !teacherId ||
              !!teacherError ||
              teacherLoading
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Send size={17} />
            )}{" "}
            {busy ? "Enviando…" : "Enviar reserva"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
