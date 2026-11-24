import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DbService } from './db/db.service.js';
import { ClientesService } from './comun/clientes.service.js';
import { EventosService } from './comun/eventos.service.js';
import { InternoMiddleware } from './comun/interno.middleware.js';
import { ReservasRepositorio } from './reservas/reservas.repositorio.js';
import { ReservasService } from './reservas/reservas.service.js';
import { AprobacionesController, InternoController, ReservasController, SaludController } from './reservas/reservas.controller.js';

@Module({
  controllers: [ReservasController, AprobacionesController, InternoController, SaludController],
  providers: [DbService, ClientesService, EventosService, ReservasRepositorio, ReservasService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(InternoMiddleware).forRoutes(ReservasController, AprobacionesController, InternoController);
  }
}
