import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // El .env vive en la raiz del monorepo, pero los scripts del backend corren con el
    // working directory en backend/. Se buscan los dos lugares para que funcione tanto
    // `npm run dev` desde la raiz como `npm run start:dev -w backend`.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
