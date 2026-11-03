import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { roles } from "../../../domain/roles.js";
import { Modal } from "../../components/Modal.jsx";

export function Users({ users, user, api, onPasswordChanged }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function reset() {
    if (busy || !selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.resetPassword(Number(selected.id));
      if (Number(selected.id) === Number(user.id)) {
        onPasswordChanged(
          "Contraseña inicial restablecida. Inicia sesión nuevamente.",
        );
      } else {
        setNotice(`${selected.name}: ${result.message}`);
        setSelected(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>Usuarios del sistema</h1>
      </div>
      {notice && (
        <div className="success-message" role="status">
          {notice}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>
                  <span className="role-pill">{roles[account.role]}</span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Restablecer contraseña de ${account.name}`}
                    disabled={
                      !Number(account.active ?? 1) ||
                      !Number(account.canResetPassword)
                    }
                    title={
                      !Number(account.canResetPassword)
                        ? "Sin contraseña inicial configurada"
                        : "Restablecer contraseña"
                    }
                    onClick={() => {
                      setSelected(account);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <KeyRound size={18} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <Modal
          title="Restablecer contraseña"
          busy={busy}
          onClose={() => setSelected(null)}
        >
          <p>
            Se restaurará la contraseña inicial de{" "}
            <strong>{selected.name}</strong> ({selected.email}) y se cerrarán
            sus sesiones abiertas.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <footer className="dialog-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={reset}
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <KeyRound size={18} />
              )}
              {busy ? "Restableciendo…" : "Restablecer contraseña inicial"}
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
