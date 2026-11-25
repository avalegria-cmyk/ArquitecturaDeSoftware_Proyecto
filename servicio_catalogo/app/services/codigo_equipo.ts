import { Equipo } from '#models/equipo'
import { siguiente } from '#models/contador'

export function prefijo(categoria: string): string {
  switch (categoria.trim().toLocaleLowerCase('es')) {
    case 'computadoras':
    case 'laptops':
      return 'LAP'
    case 'cámaras':
    case 'camaras':
      return 'CAM'
    case 'proyectores':
      return 'PRO'
    case 'iot y electrónica':
    case 'iot y electronica':
      return 'IOT'
    case 'laboratorio':
      return 'LAB'
    case 'audiovisuales':
      return 'AV'
    default:
      return 'EQ'
  }
}

/** Genera el siguiente código libre de la categoría, por ejemplo CAM-003. */
export async function siguienteCodigo(categoria: string): Promise<string> {
  const base = prefijo(categoria)
  for (;;) {
    const codigo = `${base}-${String(await siguiente(`code:${base}`)).padStart(3, '0')}`
    if (!(await Equipo.exists({ code: codigo }))) return codigo
  }
}
