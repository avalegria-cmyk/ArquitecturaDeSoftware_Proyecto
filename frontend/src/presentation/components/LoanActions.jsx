import { Camera, Undo2 } from "lucide-react";
import { loanAction, loanState } from "../../domain/loans.js";
import { formatCampusDate } from "../../application/reservations.js";
export function LoanActions({ reservation, userId, role, now, onAction }) {
  const action = loanAction(reservation, userId, now, role);
  const state = loanState(reservation, now);
  return (
    <div className="loan-actions">
      {state && (
        <span className={`status loan-${state.className}`}>{state.label}</span>
      )}
      {action && (
        <button
          type="button"
          className="secondary"
          disabled={!action.enabled}
          title={action.reason || action.label}
          onClick={() => onAction(reservation, action.phase)}
        >
          {action.phase === "inicio" ? (
            <Camera size={16} />
          ) : (
            <Undo2 size={16} />
          )}
          {action.label}
        </button>
      )}
      {action?.reason && <small>{action.reason}</small>}
      {reservation.loan?.returnedAt ? (
        <small>Devuelto: {formatCampusDate(reservation.loan.returnedAt)}</small>
      ) : reservation.loan ? (
        <small>
          Inicio real: {formatCampusDate(reservation.loan.startedAt)}
        </small>
      ) : action?.phase === "inicio" &&
        now < Date.parse(reservation.startsAt) ? (
        <small>Desde {formatCampusDate(reservation.startsAt)}</small>
      ) : null}
      {!state && <small>Se habilita al completar las aprobaciones.</small>}
    </div>
  );
}
