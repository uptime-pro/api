import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module.js');

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });

  const config = new DocumentBuilder()
    .setTitle('Uptime Pro API')
    .setDescription('Self-hosted uptime monitoring API')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addBearerAuth({ type: 'apiKey', in: 'header', name: 'Authorization' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputDir = resolve(__dirname, '../../docs/api');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'openapi.json'), JSON.stringify(document, null, 2));
  console.log('✅ OpenAPI spec written to docs/api/openapi.json');
  await app.close();
  process.exit(0);
}

generate().catch((err) => { console.error(err); process.exit(1); });
