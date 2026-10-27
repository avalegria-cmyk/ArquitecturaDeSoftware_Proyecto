import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Wrench,
  Ban,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { summarizeEquipment } from "../../application/catalog.js";
import { EquipmentCard } from "./Catalog.jsx";
export function Dashboard({ user, items, onNavigate, onSelect }) {
  const s = summarizeEquipment(items);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h1>
            Hola, {user.name.split(" ")[0]}{" "}
            <span className="greeting-dot">.</span>
          </h1>
          <p>
            Todo listo para conectar tus proyectos con los recursos de la
            universidad.
          </p>
        </div>
        <span className="date-label">
          <CalendarDays size={16} />
          {new Intl.DateTimeFormat("es-EC", {
            day: "numeric",
            month: "long",
            timeZone: "America/Guayaquil",
          }).format(new Date())}
        </span>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">IDEAS GRANDES, RECURSOS COMPARTIDOS</span>
          <h2>
            Tu próximo proyecto
            <br />
            empieza con el equipo correcto.
          </h2>
          <p>Computadoras, kits IoT y herramientas de laboratorio.</p>
          <button onClick={() => onNavigate("equipos")}>
            Explorar catálogo <ArrowRight size={17} />
          </button>
        </div>
        <div className="banner-emblem" aria-hidden="true">
          <Boxes size={105} strokeWidth={0.8} />
          <span>
            UNIVERSIDAD
            <br />
            CONECTADA
          </span>
        </div>
      </section>
      <div className="stats">
        {[
          [Boxes, "Equipos registrados", s.total, "blue"],
          [CheckCircle2, "Disponibles ahora", s.available, "green"],
          [Wrench, "En mantenimiento", s.maintenance, "amber"],
          [Ban, "Fuera de servicio", s.unavailable, "slate"],
        ].map(([Icon, label, value, tone]) => (
          <div className="stat" key={label}>
            <span className={"stat-icon " + tone}>
              <Icon size={21} />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section>
        <div className="section-heading">
          <div>
            <h2>Equipos a tu alcance</h2>
            <p>Conoce los recursos del catálogo universitario.</p>
          </div>
          <button className="text-button" onClick={() => onNavigate("equipos")}>
            Ver todos <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="equipment-grid dashboard-grid">
          {items.slice(0, 3).map((item) => (
            <EquipmentCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
        {!items.length && (
          <div className="empty">Todavía no hay equipos registrados.</div>
        )}
      </section>
      <div className="phase-note">
        <span className="phase-dot" />
        <p>
          <strong>Proyecto en desarrollo</strong> · Catálogo y solicitudes de
          reserva, aprobaciones y uso/devolución con evidencia disponibles. El
          mantenimiento y los reportes se incorporarán en las siguientes etapas.
        </p>
      </div>
    </>
  );
}
