import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { UsuarioActual, type Usuario } from '../comun/usuario.js';
import { noEncontrado } from '../comun/errores.js';
import { ReservasService } from './reservas.service.js';

/** Rutas del navegador (a través del API Gateway). */
@Controller('api/reservations')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Get()
  historial(@UsuarioActual() usuario: Usuario) {
    return this.reservas.historial(usuario);
  }

  @Post()
  @HttpCode(201)
  crear(@UsuarioActual() usuario: Usuario, @Body() datos: Record<string, unknown>) {
    return this.reservas.crear(usuario, datos ?? {});
  }

  @Get('teachers')
  docentes(@UsuarioActual() _usuario: Usuario) {
    return this.reservas.docentes();
  }

  @Get('availability')
  disponibilidad(@UsuarioActual() _usuario: Usuario, @Query() consulta: Record<string, unknown>) {
    return this.reservas.disponibilidad(consulta);
  }
}

@Controller('api/approvals')
export class AprobacionesController {
  constructor(private readonly reservas: ReservasService) {}

  @Get()
  bandeja(@UsuarioActual() usuario: Usuario) {
    return this.reservas.bandeja(usuario);
  }

  @Post('decision')
  @HttpCode(200)
  decidir(@UsuarioActual() usuario: Usuario, @Body() datos: Record<string, unknown>) {
    return this.reservas.decidir(usuario, datos ?? {});
  }
}

/** API interna: la usan Préstamos y Reportes. */
@Controller('internal/reservations')
export class InternoController {
  constructor(private readonly reservas: ReservasService) {}

  @Get()
  lista(@Query() consulta: Record<string, unknown>) {
    return this.reservas.lista(consulta);
  }

  @Get(':id')
  async porId(@Param('id', ParseIntPipe) id: number) {
    return (await this.reservas.porId(id)) ?? Promise.reject(noEncontrado('La reserva no existe.'));
  }

  @Post(':id/loan')
  @HttpCode(200)
  async prestamo(@Param('id', ParseIntPipe) id: number, @Body() datos: Record<string, unknown>) {
    if (!(await this.reservas.registrarPrestamo(id, datos ?? {}))) throw noEncontrado('La reserva no existe.');
    return { message: 'Préstamo registrado en la reserva.' };
  }
}

@Controller()
export class SaludController {
  @Get('health')
  salud() {
    return { status: 'ok', service: 'reservas' };
  }
}
