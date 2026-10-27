import { useState } from "react";
import { formatCampusDate } from "../../application/reservations.js";
function Evidence({ url, label, at }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure>
      {url ? (
        <>
          {failed ? (
            <p className="error">
              No se pudo cargar la foto. Reabre el detalle o inicia sesión
              nuevamente.
            </p>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title={`Abrir foto de ${label}`}
            >
              <img
                src={url}
                alt={`Foto del equipo al ${label}`}
                loading="lazy"
                onError={() => setFailed(true)}
              />
            </a>
          )}
          <figcaption>
            <strong>{label}</strong>
            <small>{formatCampusDate(at)}</small>
          </figcaption>
        </>
      ) : (
        <figcaption>Devolución pendiente</figcaption>
      )}
    </figure>
  );
}
export function LoanEvidence({ loan }) {
  if (!loan) return null;
  return (
    <section className="reservation-section">
      <h3>Uso y devolución · evidencia fotográfica</h3>
      <div className="loan-evidence">
        <Evidence
          url={loan.startPhotoUrl}
          label="Iniciar uso"
          at={loan.startedAt}
        />
        <Evidence
          url={loan.returnPhotoUrl}
          label="Devolver equipo"
          at={loan.returnedAt}
        />
      </div>
    </section>
  );
}
