import { useState } from "react";
import { Plus, LoaderCircle } from "lucide-react";
import { preparePhoto, photoSize } from "../../infrastructure/photo.js";
import { Modal } from "./Modal.jsx";
const initial = {
  code: "",
  name: "",
  category: "",
  status: "disponible",
  location: "",
  description: "",
};
export function EquipmentForm({
  api,
  items,
  onClose,
  onSaved,
  equipment = null,
}) {
  const [form, setForm] = useState(
    equipment
      ? Object.fromEntries(
          Object.keys(initial).map((key) => [key, equipment[key]]),
        )
      : initial,
  );
  const [photos, setPhotos] = useState([]),
    [removeImageIds, setRemoveImageIds] = useState([]),
    [processing, setProcessing] = useState(false);
  const existing = (equipment?.images || []).filter(
    (image) => !removeImageIds.includes(image.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const categories = [
    ...new Set([
      "Computadoras",
      "Cámaras",
      "Proyectores",
      "IoT y electrónica",
      "Audiovisuales",
      "Laboratorio",
      ...items.map((e) => e.category),
    ]),
  ];
  const update = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    if (busy || processing) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...Object.fromEntries(
          Object.entries(form).map(([key, value]) => [key, value.trim()]),
        ),
        photos: photos.map((photo) => photo.base64),
      };
      if (equipment) {
        await api.updateEquipment({
          ...payload,
          id: equipment.id,
          removeImageIds,
        });
        const refreshed = await api.equipment();
        onSaved(
          refreshed.equipment.find((item) => item.id === equipment.id) ||
            equipment,
        );
      } else {
        const result = await api.createEquipment(payload);
        onSaved(result.equipment);
      }
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  async function addPhotos(files) {
    if (!files.length) return;
    if (existing.length + photos.length + files.length > 5) {
      setError("Puedes guardar hasta 5 imágenes por equipo.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const prepared = [];
      for (const file of files) prepared.push(await preparePhoto(file));
      setPhotos((current) => [...current, ...prepared]);
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  }
  return (
    <Modal
      title={equipment ? "Modificar equipo" : "Agregar equipo"}
      subtitle="Registra una unidad física con su propio código de inventario."
      onClose={onClose}
      busy={busy || processing}
    >
      <form onSubmit={submit}>
        <fieldset className="form-fields" disabled={busy || processing}>
          <div className="form-grid">
            <label>
              Código de inventario
              <input
                readOnly
                value={
                  equipment && equipment.category === form.category
                    ? equipment.code
                    : form.category
                      ? `${{ Computadoras: "LAP", Laptops: "LAP", Cámaras: "CAM", Proyectores: "PRO", "IoT y electrónica": "IOT", Audiovisuales: "AV", Laboratorio: "LAB" }[form.category] || "EQ"}-Automático`
                      : "Selecciona primero el tipo o categoría"
                }
              />
              <small>
                El consecutivo definitivo se asigna al guardar. Si cambias la
                categoría se genera un código de esa categoría.
              </small>
            </label>
            <label>
              Nombre del equipo
              <input
                name="name"
                value={form.name}
                onChange={update}
                placeholder="Kit de desarrollo ESP32"
                maxLength={120}
                required
              />
            </label>
            <label>
              Tipo o categoría
              <input
                name="category"
                value={form.category}
                onChange={update}
                list="equipment-categories"
                placeholder="Selecciona o escribe una categoría"
                maxLength={60}
                required
              />
              <datalist id="equipment-categories">
                {categories.map((c) => (
                  <option value={c} key={c} />
                ))}
              </datalist>
            </label>
            <label>
              {equipment
                ? "Estado actual (gestionado por el sistema)"
                : "Estado inicial"}
              <select
                disabled={!!equipment}
                name="status"
                value={form.status}
                onChange={update}
                required
              >
                {equipment?.status === "prestado" && (
                  <option value="prestado">En préstamo</option>
                )}
                {equipment?.status === "deshabilitado" && (
                  <option value="deshabilitado">Deshabilitado</option>
                )}
                <option value="disponible">Disponible</option>
                <option value="mantenimiento">En mantenimiento</option>
                <option value="fuera_servicio">Fuera de servicio</option>
              </select>
            </label>
            <label className="full-width">
              Ubicación
              <input
                name="location"
                value={form.location}
                onChange={update}
                placeholder="Laboratorio de electrónica"
                maxLength={120}
                required
              />
            </label>
            <label className="full-width">
              Descripción y condición
              <textarea
                name="description"
                value={form.description}
                onChange={update}
                placeholder="Características, accesorios incluidos y condición del equipo."
                maxLength={2000}
                rows={4}
                required
              />
            </label>
          </div>
          <section className="reservation-section">
            <h3>Imágenes del equipo</h3>
            <p className="form-hint">
              Hasta 5 fotos. Se comprimen antes de subir. La primera se muestra
              en el catálogo.
            </p>
            <div className="inventory-images">
              {existing.map((image) => (
                <figure key={image.id}>
                  <img src={image.url} alt="Imagen actual del equipo" />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setRemoveImageIds((ids) => [...ids, image.id])
                    }
                  >
                    Quitar imagen
                  </button>
                </figure>
              ))}
              {photos.map((photo, index) => (
                <figure key={index}>
                  <img src={photo.preview} alt="Nueva imagen del equipo" />
                  <small>{photoSize(photo.size)}</small>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setPhotos((items) => items.filter((_, i) => i !== index))
                    }
                  >
                    Quitar imagen
                  </button>
                </figure>
              ))}
            </div>
            <label>
              Agregar fotos
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={
                  processing || busy || existing.length + photos.length >= 5
                }
                onChange={(event) => {
                  const files = Array.from(event.target.files);
                  event.target.value = "";
                  addPhotos(files);
                }}
              />
            </label>
            {processing && <p role="status">Comprimiendo imágenes…</p>}
          </section>
        </fieldset>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <footer className="dialog-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy || processing}
          >
            Cancelar
          </button>
          <button className="primary" disabled={busy || processing}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}{" "}
            {busy
              ? "Guardando…"
              : equipment
                ? "Guardar cambios"
                : "Agregar equipo"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
