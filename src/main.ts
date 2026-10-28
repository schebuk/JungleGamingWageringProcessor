import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { v4 as uuidv4 } from 'uuid';
import { correlationStore, structuredLogger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
    bufferLogs: true,
  });

  app.use((req: any, res: any, next: () => void) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    const store = new Map([['correlationId', correlationId]]);
    correlationStore.run(store, () => next());
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  structuredLogger.log(`Wagering Processor rodando na porta ${port}`, 'Bootstrap');
}

bootstrap();