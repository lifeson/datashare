import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UploadFileDto } from './dto/upload-file.dto';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { CleanupUploadOnErrorInterceptor } from './interceptors/cleanup-upload-on-error.interceptor';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** US01 — Téléverse un fichier et renvoie ses métadonnées + le lien de téléchargement. */
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'), CleanupUploadOnErrorInterceptor)
  @UseFilters(MulterExceptionFilter)
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni.');
    }
    return this.filesService.createFromUpload({
      ownerId: user.userId,
      originalName: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      password: dto.password,
      expiresInDays: dto.expiresInDays,
    });
  }
}
