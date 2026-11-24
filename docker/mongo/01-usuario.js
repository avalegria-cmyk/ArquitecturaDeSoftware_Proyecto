// MongoDB de los microservicios: catalogo_db con un usuario que solo puede usar esa base.
db = db.getSiblingDB('catalogo_db');
db.createUser({
  user: 'catalogo',
  pwd: process.env.CATALOGO_DB_PASSWORD,
  roles: [{ role: 'readWrite', db: 'catalogo_db' }],
});
