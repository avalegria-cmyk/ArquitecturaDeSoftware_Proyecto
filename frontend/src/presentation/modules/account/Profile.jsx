import { useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { roles } from "../../../domain/roles.js";

export function Profile({ user, api, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (newPassword !== confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.changePassword({
        currentPassword,
        newPassword,
        confirmation,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      onPasswordChanged(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>Mi perfil</h1>
      </div>
      <div className="profile-layout">
        <section className="profile-card">
          <span className="avatar large">{user.name.slice(0, 1)}</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="role-pill">{roles[user.role]}</span>
        </section>
        <section className="password-card">
          <h2>
            <KeyRound size={22} /> Cambiar contraseña
          </h2>
          <form onSubmit={submit}>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <fieldset className="form-fields" disabled={busy}>
              <label>
                Contraseña actual
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  aria-describedby="password-help"
                />
              </label>
              <label>
                Confirmar nueva contraseña
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                />
              </label>
              <button
                type="button"
                className="text-button"
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
                {show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              </button>
              <p className="form-hint" id="password-help">
                Mínimo 8 caracteres. Al guardar, volverás a iniciar sesión.
              </p>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <KeyRound size={18} />
                )}
                {busy ? "Guardando…" : "Guardar contraseña"}
              </button>
            </fieldset>
          </form>
        </section>
      </div>
    </>
  );
}
