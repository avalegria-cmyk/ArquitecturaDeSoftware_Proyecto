import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal.jsx";
import { LoanEvidence } from "./LoanEvidence.jsx";
import {
  preparePhoto,
  photoSize,
  canvasJpeg,
} from "../../infrastructure/photo.js";
export function MaintenanceReviewDialog({ item, api, onClose, onSaved }) {
  const [comments, setComments] = useState("");
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
    if (sending || processing || !photo || !comments.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.completeMaintenance({
        equipmentId: item.id,
        loanId: item.loanId,
        comments: comments.trim(),
        photo: photo.base64,
      });
      onSaved();
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      if (alive.current) setSending(false);
    }
  }
  return (
    <Modal
      title={`${item.code} · ${item.name}`}
      subtitle="Revisión técnica para habilitar el equipo"
      onClose={onClose}
      busy={sending || processing}
    >
      <p>
        {item.location} · {item.description}
      </p>
      <LoanEvidence loan={item.loan} />
      <form onSubmit={submit}>
        <label>
          Comentarios de la revisión
          <textarea
            rows={4}
            maxLength={2000}
            required
            value={comments}
            disabled={sending}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Describe el estado del equipo, las comprobaciones realizadas y si está listo para volver a usarse."
          />
        </label>
        <h3>Foto tomada durante la revisión</h3>
        <p className="form-hint">
          Muestra el equipo completo y su código. La foto se comprime en alta
          calidad antes de subir.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {camera && (
          <div className="loan-camera">
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              aria-label="Cámara para revisión"
            />
            <button
              type="button"
              className="primary"
              disabled={processing || sending}
              onClick={capture}
            >
              <Camera size={16} />
              Tomar foto
            </button>
            <button
              type="button"
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
        {photo && (
          <figure className="loan-photo-preview">
            <img src={photo.preview} alt={`Foto de revisión de ${item.code}`} />
            <figcaption>
              {photoSize(photo.size)} · {photo.width} × {photo.height} px
            </figcaption>
          </figure>
        )}
        <div className="loan-photo-controls">
          <button
            type="button"
            className="secondary"
            onClick={openCamera}
            disabled={sending || processing || openingCamera || camera}
          >
            <Camera size={16} />
            {openingCamera
              ? "Abriendo cámara…"
              : photo
                ? "Tomar otra foto"
                : "Abrir cámara"}
          </button>
          <label className="photo-file-button">
            Tomar o seleccionar foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={sending || processing || openingCamera}
              onChange={(e) => {
                const file = e.target.files[0];
                e.target.value = "";
                selectPhoto(file);
              }}
            />
          </label>
        </div>
        {processing && (
          <p role="status">
            <LoaderCircle className="spin" size={16} />
            Preparando foto…
          </p>
        )}
        <p className="notice">
          Al habilitarlo confirmas que está listo para utilizarse. Pasará a
          Disponible; se conservan las reservas futuras existentes.
        </p>
        <footer className="dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={sending || processing}
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={sending || processing || !photo || !comments.trim()}
          >
            {sending ? "Guardando revisión…" : "Habilitar equipo"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
