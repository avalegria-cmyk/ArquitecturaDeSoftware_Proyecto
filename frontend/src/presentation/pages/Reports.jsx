import { ExcelIcon } from "../components/ExcelIcon.jsx";
import { useEffect, useState } from "react";
import { History, LoaderCircle } from "lucide-react";
import { useRealtimeRevision } from "../components/RealtimeContext.jsx";
import { formatCampusDate } from "../../application/reservations.js";
const states = {
  disponible: "Disponible",
  prestado: "En préstamo",
  mantenimiento: "En mantenimiento",
  fuera_servicio: "Fuera de servicio",
  deshabilitado: "Deshabilitado",
};
export function Reports({ api }) {
  const revision = useRealtimeRevision();
  const [report, setReport] = useState(null),
    [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null),
    [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .reports()
      .then((result) => {
        if (active) {
          setReport(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, revision]);
  async function download(id) {
    setExporting(true);
    setError("");
    try {
      await api.exportReport(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }
  const selected = report?.equipment.find((e) => e.id === selectedId);
  const loans =
    report?.loans.filter((l) => Number(l.equipmentId) === selectedId) || [];
  const reviews =
    report?.reviews.filter((m) => Number(m.equipmentId) === selectedId) || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HISTORIAL POR DISPOSITIVO</span>
          <h1>Reportes</h1>
          <p>Consulta el uso y las revisiones de cada unidad de inventario.</p>
        </div>
        <button
          className="primary"
          disabled={exporting || !report}
          onClick={() => download(null)}
        >
          <ExcelIcon size={25} />
          {exporting ? "Preparando Excel…" : "Exportar Excel general"}
        </button>
      </div>
      <div className="notice">
        Veces prestado cuenta cada inicio de uso, incluidos préstamos activos y
        pruebas del administrador. Las reservas que no se retiraron no suman. El
        Excel general incluye todos los equipos, aunque uses el buscador.
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!report ? (
        <div className="availability-message">
          <LoaderCircle className="spin" />
          Cargando reportes…
        </div>
      ) : (
        <>
          <div className="report-summary">
            <span>
              <strong>{report.equipment.length}</strong> equipos
            </span>
            <span>
              <strong>{report.loans.length}</strong> préstamos iniciados
            </span>
            <span>
              <strong>
                {report.loans.filter((l) => !l.returnedAt).length}
              </strong>{" "}
              en uso
            </span>
            <span>
              <strong>{report.reviews.length}</strong> revisiones completadas
            </span>
          </div>
          <label className="report-search">
            Buscar dispositivo
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, nombre o categoría…"
            />
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Estado actual</th>
                  <th>Veces prestado</th>
                  <th>En uso</th>
                  <th>Revisiones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {report.equipment
                  .filter((e) =>
                    `${e.code} ${e.name} ${e.category}`
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase()),
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>
                          {e.code} · {e.name}
                        </strong>
                        <p>
                          {e.category} · {e.location}
                        </p>
                      </td>
                      <td>{states[e.status]}</td>
                      <td>{e.totalLoans}</td>
                      <td>{e.activeLoans}</td>
                      <td>{e.totalReviews}</td>
                      <td>
                        <div className="report-actions">
                          <button
                            className="secondary"
                            onClick={() => setSelectedId(e.id)}
                          >
                            <History size={16} />
                            Ver historial
                          </button>
                          <button
                            className="primary"
                            disabled={exporting}
                            onClick={() => download(e.id)}
                          >
                            <ExcelIcon size={24} />
                            Excel del equipo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!report.equipment.length && (
            <div className="reservation-empty">No hay equipos registrados.</div>
          )}
          {selected && (
            <section className="reservation-history report-detail">
              <div className="history-heading">
                <div>
                  <h2>
                    {selected.code} · {selected.name}
                  </h2>
                  <p>
                    {selected.totalLoans} préstamos iniciados ·{" "}
                    {selected.totalReviews} revisiones completadas
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={exporting}
                  onClick={() => download(selected.id)}
                >
                  <ExcelIcon size={24} />
                  Exportar Excel de este equipo
                </button>
              </div>
              <h3>Historial de préstamos</h3>
              {!loans.length ? (
                <p>Este dispositivo todavía no ha sido prestado.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Reserva / solicitante</th>
                        <th>Docente</th>
                        <th>Horario reservado</th>
                        <th>Uso real</th>
                        <th>Estado</th>
                        <th>Motivo</th>
                        <th>Evidencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((l) => (
                        <tr key={l.id}>
                          <td>
                            RES-{String(l.reservationId).padStart(5, "0")}
                            <p>{l.requester}</p>
                            <small>{l.email}</small>
                          </td>
                          <td>{l.teacher}</td>
                          <td>
                            {formatCampusDate(l.reservedStart)}
                            <p>Hasta {formatCampusDate(l.reservedEnd)}</p>
                          </td>
                          <td>
                            {formatCampusDate(l.startedAt)}
                            <p>
                              {l.returnedAt
                                ? `Devuelto: ${formatCampusDate(l.returnedAt)}`
                                : "Devolución pendiente"}
                            </p>
                          </td>
                          <td>{l.state}</td>
                          <td className="preserve-lines">{l.purpose}</td>
                          <td>
                            <div className="report-actions">
                              <a
                                className="secondary"
                                href={l.startPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Foto inicial
                              </a>
                              {l.returnPhotoUrl && (
                                <a
                                  className="secondary"
                                  href={l.returnPhotoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Foto devolución
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h3>Revisiones de mantenimiento</h3>
              {!reviews.length ? (
                <p>No hay revisiones completadas para esta unidad.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Revisado por</th>
                        <th>Comentarios</th>
                        <th>Evidencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((m) => (
                        <tr key={m.id}>
                          <td>{formatCampusDate(m.reviewedAt)}</td>
                          <td>{m.reviewer}</td>
                          <td className="preserve-lines">{m.comments}</td>
                          <td>
                            <a
                              className="primary review-photo-button"
                              href={m.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
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
          )}
        </>
      )}
    </>
  );
}
