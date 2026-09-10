import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Traduit les erreurs de téléversement en réponses HTTP explicites.
 * - dépassement de taille → 413 avec le message attendu par la maquette ;
 * - autres erreurs Multer → 400.
 *
 * NestJS 11 convertit déjà `LIMIT_FILE_SIZE` en `PayloadTooLargeException` ;
 * on intercepte les deux formes pour uniformiser le message.
 */
@Catch(MulterError, PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(
    exception: MulterError | PayloadTooLargeException,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    const tooLarge =
      exception instanceof PayloadTooLargeException ||
      exception.code === 'LIMIT_FILE_SIZE';

    const status = tooLarge
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : HttpStatus.BAD_REQUEST;
    const message = tooLarge
      ? 'La taille des fichiers est limitée à 1 Go.'
      : `Erreur de téléversement : ${exception.message}`;

    this.logger.warn(`Upload rejeté (${status}): ${exception.message}`);
    response.status(status).json({
      statusCode: status,
      error: tooLarge ? 'Payload Too Large' : 'Bad Request',
      message,
    });
  }
}
