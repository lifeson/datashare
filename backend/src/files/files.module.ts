import { Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { FORBIDDEN_EXTENSIONS } from './constants';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { CleanupUploadOnErrorInterceptor } from './interceptors/cleanup-upload-on-error.interceptor';
import { StoredFile, StoredFileSchema } from './schemas/file.schema';
import { StorageModule } from './storage/storage.module';
import { StorageService } from './storage/storage.service';
import { FilesCleanupService } from './files-cleanup.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoredFile.name, schema: StoredFileSchema },
    ]),
    AuthModule,
    StorageModule,
    MulterModule.registerAsync({
      imports: [StorageModule],
      inject: [StorageService, ConfigService],
      useFactory: (storage: StorageService, config: ConfigService) => ({
        storage: diskStorage({
          destination: (_req, _file, cb) => cb(null, storage.getRoot()),
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: {
          // ConfigService renvoie une chaîne → conversion explicite en octets.
          fileSize: Number(config.get('MAX_FILE_SIZE')) || 1_073_741_824,
        },
        fileFilter: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          if (FORBIDDEN_EXTENSIONS.includes(ext)) {
            cb(
              new UnsupportedMediaTypeException(
                `Type de fichier non autorisé (${ext || 'inconnu'}).`,
              ),
              false,
            );
            return;
          }
          cb(null, true);
        },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    CleanupUploadOnErrorInterceptor,
    FilesCleanupService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
