import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';

@ApiTags('Estado')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: 'Estado del servicio',
    description:
      'Devuelve un texto fijo que confirma que el backend está en pie. No consulta la base de datos ni requiere autenticación.',
  })
  @ApiOkResponse({
    description: 'El backend está operativo.',
    schema: { type: 'string' },
  })
  @Get()
  estado(): string {
    return this.appService.estado();
  }
}
