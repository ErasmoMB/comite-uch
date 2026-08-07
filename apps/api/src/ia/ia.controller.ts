import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsultarDto } from './dto/consultar.dto';
import { IaService } from './ia.service';

@Controller('ia')
@UseGuards(JwtAuthGuard)
export class IaController {
  constructor(private readonly ia: IaService) {}

  /**
   * GET /ia/estado
   * Permite a la interfaz OCULTAR el botón cuando el servidor no tiene clave
   * configurada, en vez de mostrarlo y fallar al pulsarlo.
   */
  @Get('estado')
  estado() {
    return { disponible: this.ia.estaDisponible() };
  }

  /** POST /ia/evaluacion/:id/sugerir-rubrica?regenerar=true */
  @Post('evaluacion/:id/sugerir-rubrica')
  sugerirRubrica(
    @Param('id', ParseIntPipe) id: number,
    @Query('regenerar') regenerar: string | undefined,
    @Req() req: any,
  ) {
    return this.ia.sugerirRubrica(id, req.user, regenerar === 'true');
  }

  /**
   * GET /ia/expediente/:id/documentos
   * Documentos del expediente sobre los que se puede preguntar. La interfaz
   * arma el selector con esto en vez de asumir qué subió el solicitante.
   */
  @Get('expediente/:id/documentos')
  documentos(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ia.listarDocumentos(id, req.user);
  }

  /** POST /ia/expediente/:id/consultar */
  @Post('expediente/:id/consultar')
  consultar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConsultarDto,
    @Req() req: any,
  ) {
    return this.ia.consultarExpediente(id, dto.pregunta, req.user, dto.documentoId);
  }
}
