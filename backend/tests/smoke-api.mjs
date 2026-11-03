import assert from 'node:assert/strict';
const base = process.env.API_URL || 'http://localhost:8088/api';
const origin = new URL(base).origin;
const password = process.env.DEMO_PASSWORD || 'DemoEquipos2026!';
let checks = 0;
function check(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
async function call(path, {method='GET', body, cookie, extra={}}={}) {
 return fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Requested-With':'UniEquipos',Origin:origin,...(cookie?{Cookie:cookie}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
check((await call('/equipment')).status,401,'El catálogo requiere sesión');
check((await call('/auth/login',{method:'POST',body:{email:'administrador@demo.uniequipos.test',password:'incorrecta'}})).status,401,'Contraseña incorrecta');
check((await call('/auth/login',{method:'POST',body:{email:[],password:'incorrecta'}})).status,422,'Entrada inválida');
check((await call('/auth/login',{method:'POST',body:{},extra:{Origin:'https://otro-origen.test'}})).status,403,'Rechazo de otro origen');
for (const role of ['administrador','encargado','estudiante','docente']) {
 const login=await call('/auth/login',{method:'POST',body:{email:role+'@demo.uniequipos.test',password}});
 check(login.status,200,'Login '+role);
 const setCookie=login.headers.get('set-cookie');
 assert.ok(setCookie?.includes('HttpOnly')); assert.ok(setCookie.includes('SameSite=Strict')); checks+=2;
 const cookie=setCookie.split(';')[0];
 const identity=await login.json(); check(identity.user.role,role,'Rol correcto');
 check('passwordHash' in identity.user,false,'No filtrar contraseña');
 check((await call('/auth/me',{cookie})).status,200,'Sesión vigente');
 const equipment=await call('/equipment',{cookie});check(equipment.status,200,'Catálogo autenticado');
 assert.ok((await equipment.json()).equipment.length>=6);checks++;
 check((await call('/users',{cookie})).status,role==='administrador'?200:403,'Permiso de usuarios');
 check((await call('/auth/logout',{method:'POST',body:{},cookie})).status,200,'Cierre de sesión');
 check((await call('/auth/me',{cookie})).status,401,'El token copiado queda revocado');
}
console.log(`API verificada: ${checks} comprobaciones. Cuatro roles, validación, origen, catálogo, permisos, cookies y revocación.`);
