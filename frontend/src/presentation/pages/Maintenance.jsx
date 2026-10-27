import { useEffect, useState } from "react";
import { Wrench, Info, LoaderCircle, Image } from "lucide-react";
import { useRealtimeRevision } from "../components/RealtimeContext.jsx";
import { MaintenanceReviewDialog } from "../components/MaintenanceReviewDialog.jsx";

import { formatCampusDate } from "../../application/reservations.js";
export function Maintenance({ api }) {
  const revision = useRealtimeRevision();
  const [history, setHistory] = useState([]);
  const [localRevision, setLocalRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([api.maintenance(), api.maintenanceReviews()])
      .then(([result, reviews]) => {
        if (active) {
          setItems(result.equipment);
          setHistory(reviews.reviews);
          setError("");
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
  }, [api, revision, localRevision]);
  const selected = items.find((item) => item.id === selectedId);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CUIDADO DE LOS RECURSOS</span>
          <h1>Mantenimiento</h1>
          <p>Equipos pendientes de revisión antes de volver a prestarse.</p>
        </div>
        <span className="role-pill">
          {items.length} equipos en mantenimiento
        </span>
      </div>
      <div className="notice">
        Cada devolución envía la unidad a mantenimiento. Mientras permanezca
        aquí, no admite nuevas reservas ni inicio de uso, incluso si una reserva
        ya estaba aprobada.
      </div>
      {error && (
        <div className="error" role="alert">
          {error} La conexión volverá a sincronizar automáticamente.
        </div>
      )}
      <section className="reservation-history">
        <div className="history-heading">
          <div>
            <h2>Equipos por revisar</h2>
            <p>
              Devoluciones y unidades registradas en mantenimiento ·
              Actualización automática
            </p>
          </div>
        </div>
        {loading ? (
          <div className="availability-message">
            <LoaderCircle className="spin" />
            Cargando equipos…
          </div>
        ) : !items.length && !error ? (
          <div className="reservation-empty">
            <Wrench size={42} />
            <h3>No hay equipos en mantenimiento</h3>
            <p>Las unidades aparecerán al registrar su devolución.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipo y código</th>
                  <th>Ubicación</th>
                  <th>Último solicitante</th>
                  <th>Devolución</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.code} · {item.name}
                      </strong>
                      <p>{item.category}</p>
                    </td>
                    <td>{item.location}</td>
                    <td>{item.requester || "Sin préstamo asociado"}</td>
                    <td>
                      {item.loan
                        ? formatCampusDate(item.loan.returnedAt)
                        : "Registrado en mantenimiento"}
                    </td>
                    <td>
                      <span className="status mantenimiento">
                        En mantenimiento
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <Info size={16} />
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {notice && (
        <div className="success-message" role="status">
          {notice}
        </div>
      )}
      <section className="reservation-history">
        <div className="history-heading">
          <div>
            <h2>Historial de revisiones</h2>
            <p>Comentarios, responsable y evidencia de cada habilitación.</p>
          </div>
        </div>
        {!history.length ? (
          <div className="reservation-empty">
            Todavía no se han habilitado equipos mediante revisión.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Revisado por</th>
                  <th>Fecha</th>
                  <th>Comentarios</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {history.map((review) => (
                  <tr key={review.id}>
                    <td>
                      {review.code} · {review.name}
                    </td>
                    <td>{review.reviewer}</td>
                    <td>{formatCampusDate(review.reviewedAt)}</td>
                    <td className="preserve-lines">{review.comments}</td>
                    <td>
                      <a
                        className="primary review-photo-button"
                        href={review.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Image size={16} aria-hidden="true" />
                        Ver foto de revisión
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <MaintenanceReviewDialog
          key={selected.id}
          item={selected}
          api={api}
          onClose={() => setSelectedId(null)}
          onSaved={() => {
            setSelectedId(null);
            setNotice("Revisión registrada. El equipo ya está disponible.");
            setLocalRevision((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
