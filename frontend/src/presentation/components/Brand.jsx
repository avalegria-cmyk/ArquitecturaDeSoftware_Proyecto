import { Boxes } from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Boxes size={24} />
      </span>
      <span>
        UniEquipos<small>GESTIÓN UNIVERSITARIA</small>
      </span>
    </div>
  );
}
