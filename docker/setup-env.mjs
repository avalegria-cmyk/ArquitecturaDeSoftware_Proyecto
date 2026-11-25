import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
// Crea .env con claves aleatorias. Si ya existe, solo agrega las variables nuevas que falten.
const ejemplo = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
const aleatorio = (valor) => /^(cambiar|reemplazar)/.test(valor) ? randomBytes(24).toString('hex') : valor;
const lineas = ejemplo.split('\n').map((linea) => {
  const [clave, ...resto] = linea.split('=');
  return linea.startsWith('#') || !resto.length ? linea : `${clave}=${aleatorio(resto.join('='))}`;
});
const destino = new URL('../.env', import.meta.url);
let actual = null;
try { actual = await readFile(destino, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (actual === null) {
  await writeFile(destino, lineas.join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('.env creado con secretos aleatorios.');
} else {
  const existentes = new Set(actual.split('\n').map((l) => l.split('=')[0]));
  const nuevas = lineas.filter((l) => !l.startsWith('#') && l.includes('=') && !existentes.has(l.split('=')[0]));
  if (nuevas.length) await writeFile(destino, actual.replace(/\n?$/, '\n') + nuevas.join('\n') + '\n');
  console.log(nuevas.length ? `.env actualizado: ${nuevas.length} variables nuevas.` : '.env ya existe y está completo.');
}
