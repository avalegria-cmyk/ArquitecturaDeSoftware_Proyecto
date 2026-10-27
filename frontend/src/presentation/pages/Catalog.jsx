import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Laptop,
  Cpu,
  Camera,
  Projector,
  CircuitBoard,
  MapPin,
  X,
  Plus,
  Pencil,
  Ban,
} from "lucide-react";
import { Modal } from "../components/Modal.jsx";
import { EquipmentForm } from "../components/EquipmentForm.jsx";
import { canManage } from "../../domain/roles.js";
import { filterEquipment } from "../../application/catalog.js";
const labels = {
  disponible: "Disponible",
  prestado: "En préstamo",
  mantenimiento: "En mantenimiento",
  fuera_servicio: "Fuera de servicio",
  deshabilitado: "Deshabilitado",
};
const icons = {
  Computadoras: Laptop,
  "IoT y electrónica": Cpu,
  Audiovisuales: Projector,
  Laboratorio: CircuitBoard,
};
export function EquipmentCard({ item, onSelect }) {
  const Icon = item.code.startsWith("CAM")
    ? Camera
    : icons[item.category] || Laptop;
  return (
    <button className="equipment-card" onClick={() => onSelect(item)}>
      <div className={"equipment-art art-" + item.category.split(" ")[0]}>
        <span>{item.code}</span>
        {item.images?.length ? (
          <img
            className="equipment-cover"
            src={item.images[0].url}
            alt={item.name}
          />
        ) : (
          <Icon size={66} strokeWidth={1.3} />
        )}
      </div>
      <div className="equipment-info">
        <span className="category">{item.category}</span>
        <h3>{item.name}</h3>
        <p>
          <MapPin size={13} />
          {item.location}
        </p>
        <span className={"status " + item.status}>
          <i />
          {labels[item.status]}
        </span>
      </div>
    </button>
  );
}
export function EquipmentDetail({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <button
          className="close-modal"
          autoFocus
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          <X />
        </button>
        <span className="eyebrow">{item.code}</span>
        <h2 id="detail-title">{item.name}</h2>
        <span className={"status " + item.status}>{labels[item.status]}</span>
        {!!item.images?.length && (
          <div className="inventory-images">
            {item.images.map((image) => (
              <a
                key={image.id}
                href={image.url}
                target="_blank"
                rel="noreferrer"
              >
                <img src={image.url} alt={item.name} />
              </a>
            ))}
          </div>
        )}
        <p>{item.description}</p>
        <dl>
          <dt>Categoría</dt>
          <dd>{item.category}</dd>
          <dt>Ubicación</dt>
          <dd>{item.location}</dd>
        </dl>
        <div className="notice">
          {item.status === "deshabilitado"
            ? "Esta unidad está deshabilitada. No admite reservas ni inicio de uso; su historial se conserva."
            : "Para solicitar este equipo, entra en Reservas y selecciona Realizar nueva reserva. La disponibilidad se verifica para las fechas elegidas."}
        </div>
        <button className="primary" onClick={onClose}>
          Volver al catálogo
        </button>
      </section>
    </div>
  );
}
export function Catalog({ items, onSelect, api, user, onCreated }) {
  const [editing, setEditing] = useState(null),
    [disabling, setDisabling] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState("");
  const filtered = useMemo(
    () => filterEquipment(items, search, category, status),
    [items, search, category, status],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPLORA LOS RECURSOS</span>
          <h1>Catálogo de equipos</h1>
          <p>
            Consulta el estado y encuentra el equipo para tu próxima actividad.
          </p>
        </div>
        <div className="catalog-actions">
          <span className="count-chip">{items.length} equipos</span>
          {canManage(user.role) && (
            <button
              className="primary"
              onClick={() => {
                setAdding(true);
                setNotice("");
              }}
            >
              <Plus size={18} /> Agregar equipo
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="success-message" role="status">
          {notice}
        </div>
      )}
      {editing && (
        <EquipmentForm
          api={api}
          items={items}
          equipment={editing}
          onClose={() => setEditing(null)}
          onSaved={(equipment) => {
            onCreated(equipment);
            setEditing(null);
            setNotice(`Equipo ${equipment.code} modificado.`);
          }}
        />
      )}
      {disabling && (
        <Modal
          title={`Deshabilitar ${disabling.code}`}
          onClose={() => {
            if (!busy) setDisabling(null);
          }}
          busy={busy}
        >
          <p>
            Esta unidad quedará bloqueada para nuevas reservas e inicios de uso.
            Sus datos, imágenes e historial se conservan.
          </p>
          <p>
            Las reservas existentes no se eliminan; no podrán iniciar el uso de
            la unidad deshabilitada.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <footer className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDisabling(null)}
            >
              Cancelar
            </button>
            <button
              className="approval-reject"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api.disableEquipment(disabling.id);
                  onCreated({ ...disabling, status: "deshabilitado" });
                  setNotice(
                    `Equipo ${disabling.code} deshabilitado. Historial conservado.`,
                  );
                  setDisabling(null);
                } catch (error) {
                  setError(error.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Guardando…" : "Deshabilitar equipo"}
            </button>
          </footer>
        </Modal>
      )}
      {adding && (
        <EquipmentForm
          api={api}
          items={items}
          onClose={() => setAdding(false)}
          onSaved={(equipment) => {
            onCreated(equipment);
            setAdding(false);
            setNotice(`Equipo ${equipment.code} agregado al catálogo.`);
          }}
        />
      )}
      <div className="filters">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Buscar equipo"
            placeholder="Buscar por nombre, código o ubicación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SlidersHorizontal size={18} />
        <select
          aria-label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {[...new Set(items.map((e) => e.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <p className="results">
        {filtered.length} resultados · El estado actual no garantiza
        disponibilidad para un horario futuro.
      </p>
      {filtered.length ? (
        <div className="equipment-grid">
          {filtered.map((item) => (
            <div key={item.id} className="inventory-card">
              <EquipmentCard item={item} onSelect={onSelect} />
              {canManage(user.role) && (
                <div className="inventory-card-actions">
                  <button
                    className="secondary"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={15} />
                    Modificar
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      item.status === "deshabilitado" ||
                      item.status === "prestado"
                    }
                    title={
                      item.status === "prestado"
                        ? "Primero registra la devolución"
                        : "Deshabilitar sin eliminar el historial"
                    }
                    onClick={() => {
                      setDisabling(item);
                      setError("");
                    }}
                  >
                    <Ban size={15} />
                    {item.status === "deshabilitado"
                      ? "Deshabilitado"
                      : "Deshabilitar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Search size={34} />
          <h2>No encontramos equipos</h2>
          <p>Prueba otro nombre o cambia los filtros.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setStatus("");
            }}
            className="secondary"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </>
  );
}
