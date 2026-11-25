import { test } from '@japa/runner'
import { estadoDeshabilitado, estadoTrasDevolucion, siguienteEstado } from '#services/estado_equipo'
import { prefijo } from '#services/codigo_equipo'
import { medidasJpeg } from '#services/foto'

test.group('Reglas del catálogo', () => {
  test('un equipo prestado no se puede editar de estado ni deshabilitar', ({ assert }) => {
    assert.throws(() => siguienteEstado('prestado', 'fuera_servicio'))
    assert.throws(() => estadoDeshabilitado('prestado'))
  })

  test('mantenimiento solo se habilita desde su módulo', ({ assert }) => {
    assert.throws(() => siguienteEstado('mantenimiento', 'disponible'))
  })

  test('una unidad fuera de servicio puede volver a estar disponible', ({ assert }) => {
    assert.equal(siguienteEstado('fuera_servicio', 'disponible'), 'disponible')
  })

  test('la devolución envía a revisión salvo bajas previas', ({ assert }) => {
    assert.equal(estadoTrasDevolucion('prestado'), 'mantenimiento')
    assert.equal(estadoTrasDevolucion('deshabilitado'), 'deshabilitado')
  })

  test('prefijos de código por categoría', ({ assert }) => {
    assert.equal(prefijo('Cámaras'), 'CAM')
    assert.equal(prefijo('Laptops'), 'LAP')
    assert.equal(prefijo('Otra'), 'EQ')
  })

  test('lee las medidas de un JPEG', ({ assert }) => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    assert.deepEqual(medidasJpeg(jpeg), { width: 640, height: 480 })
    assert.isNull(medidasJpeg(Buffer.from('no es jpeg')))
  })
})
