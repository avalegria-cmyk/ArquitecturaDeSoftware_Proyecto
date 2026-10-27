import { RealtimeContext } from "./components/RealtimeContext.jsx";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  CalendarDays,
  ArrowLeftRight,
  Wrench,
  ChartNoAxesCombined,
  Users,
  UserRound,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LoaderCircle,
  Construction,
  ClipboardCheck,
} from "lucide-react";
import { roles, modulesFor } from "../domain/roles.js";
import { Brand } from "./components/Brand.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Catalog, EquipmentDetail } from "./pages/Catalog.jsx";
import { Reservations } from "./pages/Reservations.jsx";
import { Approvals } from "./pages/Approvals.jsx";
import { Maintenance } from "./pages/Maintenance.jsx";
import { Reports } from "./pages/Reports.jsx";
const nav = {
  inicio: ["Inicio", LayoutDashboard],
  equipos: ["Catálogo de equipos", Boxes],
  reservas: ["Reservas", CalendarDays],
  aprobaciones: ["Aprobaciones", ClipboardCheck],
  prestamos: ["Préstamos", ArrowLeftRight],
  mantenimiento: ["Mantenimiento", Wrench],
  reportes: ["Reportes", ChartNoAxesCombined],
  usuarios: ["Usuarios", Users],
  perfil: ["Mi perfil", UserRound],
};
const pending = {};
export function App({ api, demo }) {
  const [liveRevision, setLiveRevision] = useState(0);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("inicio"),
    [mobile, setMobile] = useState(false),
    [items, setItems] = useState([]),
    [users, setUsers] = useState([]),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .me()
      .then((r) => {
        if (active) setUser(r.user);
      })
      .catch((e) => {
        if (active && e.status !== 401 && !demo) setError(e.message);
      })
      .finally(() => {
        if (active) setBoot(false);
      });
    const expired = () => {
      setUser(null);
      setItems([]);
      setUsers([]);
      setSelected(null);
      setError("Tu sesión terminó. Vuelve a ingresar.");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expired);
    };
  }, [api, demo]);
  useEffect(() => {
    if (!user) return;
    setLiveStatus("connecting");
    return api.subscribeChanges(
      () => setLiveRevision((v) => v + 1),
      setLiveStatus,
    );
  }, [api, user?.id]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    if (!liveRevision) setLoading(true);
    setError("");
    Promise.all([
      api.equipment(),
      user.role === "administrador"
        ? api.users()
        : Promise.resolve({ users: [] }),
    ])
      .then(([e, u]) => {
        if (active) {
          setItems(e.equipment);
          setUsers(u.users);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, api, revision, liveRevision]);
  async function refreshEquipment() {
    try {
      const result = await api.equipment();
      setItems(result.equipment);
    } catch (error) {
      setError(error.message);
    }
  }
  function navigate(next) {
    if (!modulesFor(user.role).includes(next)) return;
    setPage(next);
    if (next === "equipos" || next === "inicio") refreshEquipment();
    setMobile(false);
    setSelected(null);
  }
  async function login(email, password) {
    const r = await api.login(email, password);
    setUser(r.user);
    setPage("inicio");
    setError("");
  }
  async function logout() {
    try {
      await api.logout();
      setUser(null);
      setItems([]);
      setUsers([]);
      setSelected(null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  if (boot)
    return (
      <div className="boot">
        <LoaderCircle className="spin" /> Cargando tu espacio…
      </div>
    );
  if (!user)
    return (
      <>
        {error && (
          <div className="connection-error" role="alert">
            {error}
          </div>
        )}
        <Login onLogin={login} demo={demo} />
      </>
    );
  const allowed = modulesFor(user.role),
    safePage = allowed.includes(page) ? page : "inicio";
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <Brand />
        <button
          className="mobile-close"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <span className="nav-caption">ESPACIO UNIVERSITARIO</span>
        <nav>
          {allowed
            .filter((k) => k !== "perfil")
            .map((k) => {
              const [label, Icon] = nav[k];
              return (
                <button
                  key={k}
                  className={safePage === k ? "active" : ""}
                  onClick={() => navigate(k)}
                  aria-current={safePage === k ? "page" : undefined}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {pending[k] && (
                    <i className="pending-dot" title="Próxima etapa" />
                  )}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-label">
            <span className="online-dot" /> Proyecto del primer parcial
            <small>Grupo 3 · Arquitectura de Software</small>
          </div>
          <button
            className="sidebar-profile"
            onClick={() => navigate("perfil")}
          >
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Abrir menú"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Mi espacio <ChevronRight size={13} />
            <strong>{nav[safePage][0]}</strong>
          </div>
          <div className="topbar-user">
            <span className="role-pill">{roles[user.role]}</span>
            <button
              className="avatar"
              aria-label="Ver mi perfil"
              onClick={() => navigate("perfil")}
            >
              {user.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main>
          <RealtimeContext.Provider value={liveRevision}>
            <div className="form-hint" role="status">
              {liveStatus === "connected"
                ? "● Actualización en tiempo real"
                : "Reconectando actualizaciones en tiempo real…"}
            </div>
            {demo && (
              <div className="demo-banner">
                VISTA PREVIA · Datos de ejemplo · Los cambios no se guardan
              </div>
            )}
            {error && (
              <div role="alert" className="error">
                {error}{" "}
                <button
                  className="text-button"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Reintentar
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty">
                <LoaderCircle className="spin" /> Cargando información…
              </div>
            ) : (
              <>
                {safePage === "inicio" && (
                  <Dashboard
                    user={user}
                    items={items}
                    onNavigate={navigate}
                    onSelect={setSelected}
                  />
                )}{" "}
                {safePage === "equipos" && (
                  <Catalog
                    items={items}
                    onSelect={setSelected}
                    api={api}
                    user={user}
                    onCreated={(equipment) =>
                      setItems((current) =>
                        [
                          ...current.filter((item) => item.id !== equipment.id),
                          equipment,
                        ].sort((a, b) => a.code.localeCompare(b.code)),
                      )
                    }
                  />
                )}
                {safePage === "reservas" && (
                  <Reservations
                    key="reservas"
                    api={api}
                    user={user}
                    onEquipmentChanged={refreshEquipment}
                  />
                )}{" "}
                {safePage === "prestamos" && (
                  <Reservations
                    key="prestamos"
                    api={api}
                    user={user}
                    loansMode
                    onEquipmentChanged={refreshEquipment}
                  />
                )}
                {safePage === "aprobaciones" && (
                  <Approvals api={api} user={user} />
                )}
                {safePage === "mantenimiento" && <Maintenance api={api} />}
                {safePage === "reportes" && <Reports api={api} />}
                {pending[safePage] && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">PRÓXIMA ETAPA</span>
                        <h1>{nav[safePage][0]}</h1>
                      </div>
                    </div>
                    <div className="empty upcoming">
                      <Construction size={48} />
                      <span className="pill">EN PREPARACIÓN</span>
                      <h2>{pending[safePage][0]}</h2>
                      <p>{pending[safePage][1]}</p>
                      <p>Esta función todavía no está habilitada.</p>
                      <button
                        className="primary"
                        onClick={() => navigate("equipos")}
                      >
                        Consultar catálogo
                      </button>
                    </div>
                  </>
                )}{" "}
                {safePage === "usuarios" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">ADMINISTRACIÓN</span>
                        <h1>Usuarios del sistema</h1>
                        <p>
                          Consulta inicial de cuentas y roles. La edición se
                          incorporará en otra etapa.
                        </p>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Rol</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id}>
                              <td>{u.name}</td>
                              <td>{u.email}</td>
                              <td>
                                <span className="role-pill">
                                  {roles[u.role]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}{" "}
                {safePage === "perfil" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">TU CUENTA</span>
                        <h1>Mi perfil</h1>
                      </div>
                    </div>
                    <section className="profile-card">
                      <span className="avatar large">
                        {user.name.slice(0, 1)}
                      </span>
                      <h2>{user.name}</h2>
                      <p>{user.email}</p>
                      <span className="role-pill">{roles[user.role]}</span>
                      <p className="muted">
                        Para modificar tus datos, contacta al administrador.
                      </p>
                    </section>
                  </>
                )}
              </>
            )}
            <footer className="app-footer">
              <span>UniEquipos · Gestión de préstamos y mantenimiento</span>
              <span>Grupo 3 · Primera etapa</span>
            </footer>
          </RealtimeContext.Provider>
        </main>
      </div>
      <EquipmentDetail
        item={
          selected
            ? items.find((item) => item.id === selected.id) || selected
            : null
        }
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
