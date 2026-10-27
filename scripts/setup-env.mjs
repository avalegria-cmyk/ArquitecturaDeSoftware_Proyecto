import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../.env.example',import.meta.url),'utf8');
try {
 await writeFile(new URL('../.env',import.meta.url),source.replace('cambiar-clave-local',randomBytes(20).toString('hex')).replace('cambiar-root-local',randomBytes(24).toString('hex')).replace('reemplazar-por-una-clave-aleatoria-de-64-caracteres',randomBytes(48).toString('hex')),{flag:'wx',mode:0o600});
 console.log('.env creado con secretos aleatorios.');
} catch (e) {if(e.code==='EEXIST') console.log('.env ya existe. Se conservó sin cambios.');else throw e;}
