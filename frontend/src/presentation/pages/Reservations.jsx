import { useRealtimeRevision } from "../components/RealtimeContext.jsx";
import { useEffect, useState } from "react";
import {
  Plus,
  Info,
  CalendarDays,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import {
  canRequestReservation,
  reservationStates,
} from "../../domain/reservations.js";
import {
  formatCampusDate,
  durationLabel,
} from "../../application/reservations.js";
import { LoanActions } from "../components/LoanActions.jsx";
import { LoanPhotoDialog } from "../components/LoanPhotoDialog.jsx";
import { ReservationForm } from "../components/ReservationForm.jsx";
import { ReservationDetail } from "../components/ReservationDetail.jsx";

export function Reservations({
  api,
  user,
  loansMode = false,
  onEquipmentChanged,
}) {
  const liveRevision = useRealtimeRevision();
  const [loanDialog, setLoanDialog] = useState(null);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const now = tick + offset;
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const canCreate = !loansMode && canRequestReservation(user.role);
  useEffect(() => {
    let active = true;
    if (!liveRevision) setLoading(true);
    setError("");
    (loansMode ? api.loans() : api.reservations())
      .then((result) => {
        if (active) {
          setRows(result.reservations);
          if (result.serverNow)
            setOffset(Date.parse(result.serverNow) - Date.now());
        }
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
  }, [api, user.id, revision, loansMode, liveRevision]);
  function created(reservation) {
    setCreating(false);
    setNotice(
      `Reserva RES-${String(reservation.id).padStart(5, "0")} enviada. Está en revisión y pendiente del docente responsable.`,
    );
    setRevision((value) => value + 1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SOLICITUDES DE EQUIPOS</span>
          <h1>{loansMode ? "Préstamos" : "Mis reservas"}</h1>
          <p>
            {loansMode
              ? "Inicia el uso de tus equipos y registra su devolución con fotos."
              : "Consulta tus solicitudes y sigue cada etapa de aprobación."}
          </p>
        </div>
        {canCreate && (
          <button
            className="primary"
            onClick={() => {
              setCreating(true);
              setNotice("");
            }}
          >
            <Plus size={18} /> Realizar nueva reserva
          </button>
        )}
      </div>
      {!canCreate && !loansMode && (
        <div className="notice">
          Las solicitudes se realizan desde las cuentas de estudiantes y
          docentes. Revisa las solicitudes de tu fase en el módulo Aprobaciones.
        </div>
      )}
      {notice && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      <section className="reservation-history">
        <div className="history-heading">
          <div>
            <h2>
              {loansMode
                ? "Equipos por retirar, en uso y devueltos"
                : "Historial de reservas"}
            </h2>
            <p>
              {loansMode && ["administrador", "encargado"].includes(user.role)
                ? "Seguimiento de todas las reservas aceptadas"
                : "Solicitudes realizadas por tu cuenta"}{" "}
              · Horario de Ecuador
            </p>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error} La conexión volverá a sincronizar el historial
            automáticamente.
          </div>
        )}
        {loading ? (
          <div className="availability-message" role="status">
            <LoaderCircle className="spin" size={20} /> Cargando historial…
          </div>
        ) : !rows.length && !error ? (
          <div className="reservation-empty">
            <CalendarDays size={42} />
            <h3>
              {loansMode
                ? "Aún no hay reservas aceptadas"
                : "Aún no has realizado reservas"}
            </h3>
            <p>
              {canCreate
                ? "Selecciona Realizar nueva reserva para solicitar un equipo."
                : loansMode
                  ? "Las reservas aparecerán aquí al completar todas sus aprobaciones."
                  : "Esta cuenta no tiene solicitudes registradas."}
            </p>
          </div>
        ) : (
          rows.length > 0 && (
            <div
              className="table-wrap reservation-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Historial de reservas; desplázate horizontalmente para ver todas las columnas"
            >
              <table className="reservation-table">
                <thead>
                  <tr>
                    <th>Reserva y envío</th>
                    <th>Solicitante</th>
                    <th>Equipo</th>
                    <th>Docente responsable</th>
                    <th>Inicio y devolución</th>
                    <th>Duración</th>
                    <th>Motivo</th>
                    <th>Estado y seguimiento</th>
                    <th>Uso y devolución</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
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
                          <b>Desde</b> {formatCampusDate(row.startsAt)}
                        </span>
                        <span className="date-pair">
                          <b>Hasta</b> {formatCampusDate(row.endsAt)}
                        </span>
                      </td>
                      <td>{durationLabel(row.startsAt, row.endsAt)}</td>
                      <td>
                        <p className="reservation-purpose">{row.purpose}</p>
                      </td>
                      <td>
                        <div className="reservation-state-cell">
                          <span className={`status reservation-${row.status}`}>
                            {reservationStates[row.status]}
                          </span>
                          <button
                            type="button"
                            className="info-button"
                            aria-label={`Ver seguimiento de ${row.reference}`}
                            title="Ver información y línea de tiempo"
                            onClick={() => setSelected(row)}
                          >
                            <Info size={19} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <LoanActions
                          reservation={row}
                          userId={user.id}
                          role={user.role}
                          now={now}
                          onAction={(reservation, phase) =>
                            setLoanDialog({ reservation, phase })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
      {loanDialog && (
        <LoanPhotoDialog
          api={api}
          reservation={
            rows.find((r) => r.id === loanDialog.reservation.id) ||
            loanDialog.reservation
          }
          phase={loanDialog.phase}
          userId={user.id}
          role={user.role}
          now={now}
          onClose={() => setLoanDialog(null)}
          onRefresh={() => setRevision((v) => v + 1)}
          onSaved={(message) => {
            setLoanDialog(null);
            setNotice(message);
            setRevision((v) => v + 1);
            onEquipmentChanged?.();
          }}
        />
      )}
      {creating && (
        <ReservationForm
          api={api}
          user={user}
          onClose={() => setCreating(false)}
          onCreated={created}
        />
      )}
      {selected && (
        <ReservationDetail
          reservation={rows.find((row) => row.id === selected.id) || selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
