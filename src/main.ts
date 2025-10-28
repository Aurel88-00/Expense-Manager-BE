import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import compression from 'compression';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin:
      configService.get('environment') === 'production'
        ? ['https://yourdomain.com']
        : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

 
  const config = new DocumentBuilder()
    .setTitle('Expense Management System API')
    .setDescription(`
      A comprehensive expense management system API built with NestJS and MongoDB.`)
    .setVersion('1.0.0')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addTag('Teams', 'Team management and budget tracking')
    .addTag('Expenses', 'Expense management and approval workflow')
    .addTag('Analytics', 'Budget insights and forecasting')
    .addTag('Reports', 'PDF export and reporting')
    .addServer('http://localhost:5000', 'Development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Expense Management API',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  const port = process.env.PORT || configService.get<number>('port') || 5000;
  await app.listen(port);

  console.log(`Server running on port ${port}`);
  
  // Memory monitoring for Render free tier
  setInterval(() => {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    console.log(`Memory usage: ${heapUsedMB}MB`);
    
    if (heapUsedMB > 300) { // Alert if over 300MB (60% of 512MB)
      console.warn(`⚠️ High memory usage: ${heapUsedMB}MB`);
    }
  }, 30000);
}

// Graceful shutdown for Render
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

bootstrap();
