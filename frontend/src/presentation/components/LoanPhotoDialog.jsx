import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, LoaderCircle, Upload } from "lucide-react";
import { Modal } from "./Modal.jsx";
import {
  preparePhoto,
  photoSize,
  canvasJpeg,
} from "../../infrastructure/photo.js";
import { formatCampusDate } from "../../application/reservations.js";
import { loanAction } from "../../domain/loans.js";

export function LoanPhotoDialog({
  api,
  reservation,
  phase,
  userId,
  role,
  now,
  onClose,
  onSaved,
  onRefresh,
}) {
  const [photo, setPhoto] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false),
    [sending, setSending] = useState(false);
  const [error, setError] = useState(""),
    [camera, setCamera] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const video = useRef(null),
    stream = useRef(null),
    alive = useRef(true),
    cameraRequest = useRef(0);
  const returning = phase === "devolucion";
  const action = loanAction(reservation, userId, now, role);
  const canSend = action?.phase === phase && action.enabled;
  function stopCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopCamera();
    };
  }, []);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {
        if (alive.current)
          setError(
            "No se pudo reproducir la cámara. Usa Tomar o seleccionar foto.",
          );
      });
    }
  }, [camera]);
  async function openCamera() {
    setError("");
    setOpeningCamera(true);
    const request = ++cameraRequest.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Tu navegador no permite abrir la cámara aquí. Usa Tomar o seleccionar foto.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      if (!alive.current || cameraRequest.current !== request) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setPhoto(null);
      setConfirmed(false);
      setCamera(true);
    } catch (error) {
      if (alive.current)
        setError(
          error.name === "NotAllowedError"
            ? "La cámara no tiene permiso. Permítela en el navegador o usa Tomar o seleccionar foto."
            : error.message,
        );
    } finally {
      if (alive.current) setOpeningCamera(false);
    }
  }
  async function selectPhoto(file) {
    if (!file) return;
    setProcessing(true);
    setError("");
    setPhoto(null);
    setConfirmed(false);
    stopCamera();
    setCamera(false);
    try {
      const prepared = await preparePhoto(file);
      if (alive.current) setPhoto(prepared);
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      if (alive.current) setProcessing(false);
    }
  }
  async function capture() {
    const element = video.current;
    if (!element?.videoWidth) {
      setError("Espera a que la cámara muestre la imagen.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      canvas.getContext("2d").drawImage(element, 0, 0);
      // El primer JPEG de cámara usa calidad alta; preparePhoto aplica el tamaño final.
      const blob = await canvasJpeg(canvas, 0.98);
      await selectPhoto(blob);
    } catch (error) {
      if (alive.current) {
        setError(error.message);
        setProcessing(false);
      }
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (!photo || !confirmed || sending || processing || !canSend) return;
    setSending(true);
    setError("");
    try {
      await api.recordLoan(phase, {
        reservationId: reservation.id,
        photo: photo.base64,
        completeDeviceConfirmed: true,
      });
      onSaved(
        returning
          ? "Devolución registrada con su foto. El equipo pasa a mantenimiento para revisión."
          : "Uso iniciado con su foto. Esta unidad queda Prestada hasta su devolución.",
      );
    } catch (error) {
      if (alive.current) {
        setError(error.message);
        if (error.status === 409) onRefresh();
      }
    } finally {
      if (alive.current) setSending(false);
    }
  }
  return (
    <Modal
      title={returning ? "Devolver equipo" : "Iniciar uso del equipo"}
      subtitle={`${reservation.equipment.name} · ${reservation.equipment.code}`}
      onClose={onClose}
      busy={sending || processing}
    >
      {role === "administrador" && (
        <div className="notice">
          Acción de prueba del administrador: permite iniciar sin esperar el
          horario. Guarda cambios reales en el préstamo y el inventario;
          requiere foto y conserva las aprobaciones.
        </div>
      )}
      <p className="loan-photo-instruction">
        {returning
          ? "Fotografía cómo entregas el dispositivo."
          : "Fotografía el estado del dispositivo antes de utilizarlo."}{" "}
        Encuadra el equipo completo y su etiqueta o código, con buena luz y sin
        cortar los bordes.
      </p>
      <p className="form-hint">
        Reserva: {formatCampusDate(reservation.startsAt)} →{" "}
        {formatCampusDate(reservation.endsAt)}.{" "}
        {returning
          ? "Puedes devolver antes de la hora prevista."
          : "El servidor comprueba el horario y la disponibilidad al confirmar."}
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!canSend && (
        <div className="notice">
          {action?.reason ||
            "Esta operación ya no está disponible. Cierra y actualiza el historial."}
        </div>
      )}
      {camera && (
        <div className="loan-camera">
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="Vista previa de la cámara"
          />
          <button
            className="primary"
            onClick={capture}
            disabled={processing || sending}
          >
            <Camera size={17} />
            Tomar foto
          </button>
          <button
            className="secondary"
            disabled={processing || sending}
            onClick={() => {
              stopCamera();
              setCamera(false);
            }}
          >
            Cerrar cámara
          </button>
        </div>
      )}
      {!camera && !photo && (
        <div className="photo-placeholder">
          <Camera size={44} />
          <p>Foto del equipo completo</p>
        </div>
      )}
      {photo && (
        <figure className="loan-photo-preview">
          <img
            src={photo.preview}
            alt={`Estado del equipo ${reservation.equipment.code} para ${returning ? "devolución" : "inicio de uso"}`}
          />
          <figcaption>
            {photo.width} × {photo.height} px · Lista para subir:{" "}
            {photoSize(photo.size)}
            {photo.size < photo.originalSize
              ? ` (original: ${photoSize(photo.originalSize)})`
              : ""}
          </figcaption>
        </figure>
      )}
      {processing && (
        <p role="status" className="availability-message">
          <LoaderCircle className="spin" size={18} />
          Preparando la foto…
        </p>
      )}
      <div className="loan-photo-controls">
        <button
          type="button"
          className="secondary"
          onClick={openCamera}
          disabled={openingCamera || processing || sending || camera}
        >
          {photo ? <RotateCcw size={16} /> : <Camera size={16} />}
          {openingCamera
            ? "Abriendo cámara…"
            : photo
              ? "Tomar otra foto"
              : "Abrir cámara"}
        </button>
        <label className="photo-file-button">
          <Upload size={16} />
          Tomar o seleccionar foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={openingCamera || processing || sending}
            onChange={(event) => {
              const file = event.target.files[0];
              event.target.value = "";
              selectPhoto(file);
            }}
          />
        </label>
      </div>
      <p className="form-hint">
        Se ajusta a un máximo de 2560 px y se comprime en alta calidad antes de
        subir. Revisa que los detalles sigan visibles; la compresión no es sin
        pérdida.
      </p>
      <form onSubmit={submit}>
        <label className="photo-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={!photo || sending || processing}
            required
          />
          Confirmo que la foto muestra el equipo completo, su código y su estado
          actual.
        </label>
        <footer className="dialog-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={sending || processing}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!photo || !confirmed || sending || processing || !canSend}
          >
            {sending && <LoaderCircle className="spin" size={16} />}
            {sending
              ? "Subiendo y guardando…"
              : returning
                ? "Confirmar devolución"
                : "Confirmar inicio de uso"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
