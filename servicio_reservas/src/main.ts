import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ErroresFilter } from './comun/errores.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ErroresFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3003);
}
await bootstrap();
