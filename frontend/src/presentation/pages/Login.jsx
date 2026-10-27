import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Laptop,
  Cpu,
  Projector,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
export function Login({ onLogin, demo }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">RECURSOS QUE IMPULSAN TUS IDEAS</span>
          <h1>
            El equipo que necesitas.
            <br />
            <em>Cuando lo necesitas.</em>
          </h1>
          <p>
            Un solo lugar para consultar equipos, organizar préstamos y cuidar
            los recursos de nuestra universidad.
          </p>
          <div className="device-scene" aria-hidden="true">
            <div className="device-main">
              <Laptop size={90} strokeWidth={1} />
              <span>TECNOLOGÍA A TU ALCANCE</span>
            </div>
            <div className="device-small">
              <Cpu size={35} />
            </div>
            <div className="device-small second">
              <Projector size={35} />
            </div>
          </div>
        </div>
        <div className="story-footer">
          <ShieldCheck size={17} /> Acceso organizado por roles · Grupo 3
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <span className="pill">PORTAL DE EQUIPOS</span>
          <h2>Bienvenido de nuevo</h2>
          <p className="muted">Ingresa tus credenciales para continuar.</p>
          {demo && (
            <div className="notice">
              Vista previa con datos de ejemplo. No guarda cambios en la
              universidad.
            </div>
          )}
          <form onSubmit={submit}>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@universidad.edu.ec"
              autoComplete="username"
              required
            />
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input
                id="password"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                maxLength={200}
                required
              />
              <button
                type="button"
                aria-label={
                  visible ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary login-button" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar al sistema"}
              <ArrowRight size={18} />
            </button>
          </form>
          {demo && (
            <details className="demo-accounts">
              <summary>Cuentas para explorar la vista previa</summary>
              <p>
                Contraseña: <code>DemoEquipos2026!</code>
              </p>
              {["administrador", "encargado", "estudiante", "docente"].map(
                (role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setEmail(role + "@demo.uniequipos.test");
                      setPassword("DemoEquipos2026!");
                    }}
                  >
                    {role}@demo.uniequipos.test
                  </button>
                ),
              )}
            </details>
          )}
          <div className="login-help">
            <ShieldCheck size={18} />
            <p>
              ¿Necesitas acceso?
              <br />
              <span>Solicítalo al encargado de equipos de tu institución.</span>
            </p>
          </div>
          <footer>
            Proyecto de Arquitectura de Software
            <br />
            Adonis Alegría · Pamela Tapia
          </footer>
        </div>
      </section>
    </div>
  );
}
