import { useRealtimeRevision } from "../components/RealtimeContext.jsx";
import { useEffect, useState } from "react";
import { ClipboardCheck, LoaderCircle, Info, CheckCircle2 } from "lucide-react";
import {
  approvalStages,
  reservationStates,
} from "../../domain/reservations.js";
import { formatCampusDate } from "../../application/reservations.js";
import { ReservationDetail } from "../components/ReservationDetail.jsx";

function ReviewDialog({ api, reservation, onClose, onSaved, onConflict }) {
  const [outcome, setOutcome] = useState("completado");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const stage = reservation.timeline.find(
    (s) => s.key === reservation.reviewStage,
  );
  async function submit(event) {
    event.preventDefault();
    if (busy || stale) return;
    setBusy(true);
    setError("");
    try {
      await api.reviewReservation({
        reservationId: reservation.id,
        step: reservation.reviewStage,
        outcome,
        note: note.trim(),
      });
      onSaved(
        outcome === "rechazado"
          ? `${reservation.reference} rechazada. El motivo queda registrado en su seguimiento.`
          : reservation.reviewStage === "encargado_laboratorio"
            ? `${reservation.reference} aceptada. Se completaron las tres aprobaciones.`
            : `${reservation.reference}: aprobación registrada y enviada a la siguiente fase.`,
      );
    } catch (error) {
      setError(error.message);
      // Un conflicto de etapa obliga a releer antes de intentar otra decisión.
      if (error.status === 409) {
        setStale(true);
        onConflict();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <ReservationDetail reservation={reservation} onClose={onClose} busy={busy}>
      {reservation.canDecide ? (
        <form onSubmit={submit} className="approval-form">
          <h3>Registrar decisión de esta fase</h3>
          <p className="form-hint">
            {stage?.label}. La decisión se guardará con tu nombre, fecha y
            observación.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
              {stale &&
                " Cierra el detalle y vuelve a abrir la solicitud actualizada."}
            </div>
          )}
          <fieldset className="form-fields" disabled={busy || stale}>
            <label>
              Decisión
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="completado">Aceptar en mi fase</option>
                <option value="rechazado">Rechazar la solicitud</option>
              </select>
            </label>
            <label>
              {outcome === "rechazado"
                ? "Motivo del rechazo (obligatorio)"
                : "Observación (opcional)"}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                required={outcome === "rechazado"}
                rows={3}
                placeholder={
                  outcome === "rechazado"
                    ? "Explica por qué se rechaza esta reserva…"
                    : "Añade una observación para las siguientes fases…"
                }
              />
            </label>
            <p className="form-hint">
              {outcome === "rechazado"
                ? "El rechazo termina la revisión y libera el horario del equipo."
                : reservation.reviewStage === "encargado_laboratorio"
                  ? "Esta es la última aprobación. La reserva quedará Aceptada; la entrega se registra por separado."
                  : "La solicitud seguirá En revisión hasta completar todas las aprobaciones."}
            </p>
          </fieldset>
          <footer className="dialog-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              type="submit"
              className={
                outcome === "rechazado" ? "approval-reject" : "primary"
              }
              disabled={
                busy || stale || (outcome === "rechazado" && !note.trim())
              }
            >
              {busy && <LoaderCircle size={16} className="spin" />}
              {busy
                ? "Guardando…"
                : outcome === "rechazado"
                  ? "Confirmar rechazo"
                  : "Confirmar aprobación"}
            </button>
          </footer>
        </form>
      ) : (
        <footer className="dialog-actions">
          <button type="button" className="primary" onClick={onClose}>
            Cerrar detalle
          </button>
        </footer>
      )}
    </ReservationDetail>
  );
}

export function Approvals({ api, user }) {
  const liveRevision = useRealtimeRevision();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("pendientes");
  const [revision, setRevision] = useState(0);
  const stage = approvalStages[user.role];
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    let active = true;
    if (!liveRevision) setLoading(true);
    setError("");
    api
      .approvals()
      .then((result) => {
        if (active) setRows(result.reservations);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, user.id, revision, liveRevision]);
  const pending = rows.filter((r) => r.canDecide);
  const visible = filter === "pendientes" ? pending : rows;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REVISIÓN DE SOLICITUDES</span>
          <h1>Aprobaciones</h1>
          <p>{stage.description}</p>
        </div>
        <span className="role-pill">Tu fase: {stage.label}</span>
      </div>
      <div className="notice">
        Docente responsable → Jefe de laboratorio (administrador) → Encargado de
        laboratorio. Cada fase se habilita al aprobar la anterior.
      </div>
      {notice && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      <section className="reservation-history">
        <div className="history-heading">
          <div>
            <h2>Bandeja de aprobaciones</h2>
            <p>
              Consulta la solicitud completa antes de decidir · Horario de
              Ecuador
            </p>
          </div>
        </div>
        <div
          className="approval-filters"
          role="group"
          aria-label="Filtrar aprobaciones"
        >
          <button
            className={filter === "pendientes" ? "active" : ""}
            aria-pressed={filter === "pendientes"}
            onClick={() => setFilter("pendientes")}
          >
            Pendientes de mi fase ({pending.length})
          </button>
          <button
            className={filter === "todas" ? "active" : ""}
            aria-pressed={filter === "todas"}
            onClick={() => setFilter("todas")}
          >
            Historial y seguimiento ({rows.length})
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error} La conexión volverá a sincronizar automáticamente.
          </div>
        )}
        {loading ? (
          <div className="availability-message" role="status">
            <LoaderCircle className="spin" size={20} />
            Cargando solicitudes…
          </div>
        ) : error ? null : !visible.length ? (
          <div className="reservation-empty">
            <ClipboardCheck size={42} />
            <h3>
              {filter === "pendientes"
                ? "No tienes aprobaciones pendientes"
                : "Aún no hay solicitudes en esta bandeja"}
            </h3>
            <p>
              {user.role === "docente"
                ? "Aquí aparecen las reservas donde te seleccionaron como docente responsable."
                : "Las solicitudes aparecerán cuando la fase anterior las apruebe."}
            </p>
          </div>
        ) : (
          <div
            className="table-wrap reservation-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Bandeja de aprobaciones; tabla desplazable"
          >
            <table className="reservation-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Solicitante</th>
                  <th>Equipo</th>
                  <th>Docente responsable</th>
                  <th>Inicio y devolución</th>
                  <th>Estado y fase</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const current = row.timeline.find((s) => s.current);
                  const decision = row.timeline.find(
                    (s) => s.key === row.reviewStage,
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.reference}</strong>
                        <small>{formatCampusDate(row.createdAt)}</small>
                      </td>
                      <td>
                        {row.requester.name}
                        <small>{row.requester.email}</small>
                      </td>
                      <td>
                        <strong>{row.equipment.name}</strong>
                        <small>
                          {row.equipment.code} · {row.equipment.category}
                        </small>
                        <small>{row.equipment.location}</small>
                      </td>
                      <td>{row.teacher.name}</td>
                      <td>
                        <span className="date-pair">
                          <b>Desde</b>
                          {formatCampusDate(row.startsAt)}
                        </span>
                        <span className="date-pair">
                          <b>Hasta</b>
                          {formatCampusDate(row.endsAt)}
                        </span>
                      </td>
                      <td>
                        <span className={`status reservation-${row.status}`}>
                          {reservationStates[row.status]}
                        </span>
                        <small>
                          {row.canDecide
                            ? "Pendiente de tu fase"
                            : current
                              ? `Siguiente: ${current.label.replace("Aceptado por ", "")}`
                              : "Proceso finalizado"}
                        </small>
                        {decision?.state !== "pendiente" && (
                          <small>
                            Tu fase:{" "}
                            {decision?.state === "completado"
                              ? "aprobada"
                              : "rechazada"}
                          </small>
                        )}
                      </td>
                      <td>
                        <button
                          className={
                            row.canDecide
                              ? "primary approval-review"
                              : "secondary approval-review"
                          }
                          onClick={() => setSelected(row)}
                        >
                          {row.canDecide ? (
                            <ClipboardCheck size={16} />
                          ) : (
                            <Info size={16} />
                          )}
                          {row.canDecide
                            ? "Revisar solicitud"
                            : "Ver seguimiento"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <ReviewDialog
          key={selected.id}
          api={api}
          reservation={rows.find((row) => row.id === selected.id) || selected}
          onClose={() => setSelected(null)}
          onConflict={refresh}
          onSaved={(message) => {
            setSelected(null);
            setNotice(message);
            refresh();
          }}
        />
      )}
    </>
  );
}
