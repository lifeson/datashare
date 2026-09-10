import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { StorageService } from '../storage/storage.service';

/**
 * Multer écrit le fichier sur disque **avant** la validation du corps
 * (`ValidationPipe`) et l'exécution du contrôleur. Si l'une de ces étapes
 * échoue, le fichier resterait orphelin : cet intercepteur le supprime.
 *
 * À placer **après** `FileInterceptor` dans `@UseInterceptors(...)`.
 */
@Injectable()
export class CleanupUploadOnErrorInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const request = context
          .switchToHttp()
          .getRequest<{ file?: { filename?: string } }>();
        if (request.file?.filename) {
          void this.storage.remove(request.file.filename);
        }
        return throwError(() => error);
      }),
    );
  }
}
