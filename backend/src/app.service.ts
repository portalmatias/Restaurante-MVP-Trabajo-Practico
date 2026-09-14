import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Texto fijo que confirma que el backend está en pie. */
  estado(): string {
    return 'API de Reservas de Restaurante operativa';
  }
}
