import { Check, X } from "lucide-react";
import { LoanEvidence } from "./LoanEvidence.jsx";
import { Modal } from "./Modal.jsx";
import { reservationStates } from "../../domain/reservations.js";
import {
  formatCampusDate,
  durationLabel,
} from "../../application/reservations.js";

export function ReservationDetail({
  reservation,
  onClose,
  children,
  busy = false,
}) {
  return (
    <Modal
      title={`Seguimiento de ${reservation.reference}`}
      subtitle="Consulta los datos de la solicitud y el avance de sus aprobaciones."
      onClose={onClose}
      busy={busy}
    >
      <div className="reservation-detail-status">
        <span className={`status reservation-${reservation.status}`}>
          {reservationStates[reservation.status]}
        </span>
        <span>Enviada el {formatCampusDate(reservation.createdAt)}</span>
      </div>
      <dl className="reservation-detail-grid">
        <dt>Solicitante</dt>
        <dd>
          {reservation.requester.name}
          <small>{reservation.requester.email}</small>
        </dd>
        <dt>Equipo</dt>
        <dd>
          {reservation.equipment.name}
          <small>
            {reservation.equipment.code} · {reservation.equipment.category}
          </small>
        </dd>
        <dt>Ubicación</dt>
        <dd>{reservation.equipment.location}</dd>
        <dt>Docente responsable</dt>
        <dd>
          {reservation.teacher.name}
          <small>{reservation.teacher.email}</small>
        </dd>
        <dt>Inicio</dt>
        <dd>{formatCampusDate(reservation.startsAt)}</dd>
        <dt>Devolución prevista</dt>
        <dd>{formatCampusDate(reservation.endsAt)}</dd>
        <dt>Duración</dt>
        <dd>{durationLabel(reservation.startsAt, reservation.endsAt)}</dd>
        <dt>Motivo</dt>
        <dd className="preserve-lines">{reservation.purpose}</dd>
      </dl>
      <section className="reservation-section">
        <h3>Etapas de la solicitud</h3>
        <ol className="reservation-timeline">
          {reservation.timeline.map((step) => (
            <li
              key={step.key}
              className={`${step.state} ${step.current ? "current" : ""}`}
              aria-current={step.current ? "step" : undefined}
            >
              <span className="timeline-circle" aria-hidden="true">
                {step.state === "completado" ? (
                  <Check size={15} />
                ) : step.state === "rechazado" ? (
                  <X size={15} />
                ) : null}
              </span>
              <div>
                <strong>{step.label}</strong>
                <span>
                  {step.state === "completado"
                    ? "Completado"
                    : step.state === "rechazado"
                      ? "Rechazado"
                      : step.current
                        ? "Pendiente de revisión"
                        : reservation.status === "rechazado"
                          ? "No alcanzado"
                          : "Pendiente"}
                </span>
                {step.at && (
                  <small>
                    {formatCampusDate(step.at)}
                    {step.actor && ` · ${step.actor}`}
                  </small>
                )}
                {step.note && <p>{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
        <p className="form-hint">
          El círculo lleno indica una etapa completada. La siguiente aprobación
          permanece pendiente hasta que la registre su responsable.
        </p>
      </section>
      <LoanEvidence loan={reservation.loan} />
      {children || (
        <footer className="dialog-actions">
          <button type="button" className="primary" onClick={onClose}>
            Cerrar detalle
          </button>
        </footer>
      )}
    </Modal>
  );
}
