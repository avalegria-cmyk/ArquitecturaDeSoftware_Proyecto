import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  busy = false,
  wide = false,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`form-dialog ${wide ? "form-dialog-wide" : ""}`}
      aria-labelledby="form-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-header">
        <div>
          <h2 id="form-dialog-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar ventana"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
