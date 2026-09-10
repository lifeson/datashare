import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { DownloadDto } from './dto/download.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { CleanupUploadOnErrorInterceptor } from './interceptors/cleanup-upload-on-error.interceptor';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** US01 — Téléverse un fichier (authentifié). */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        password: { type: 'string', minLength: 6 },
        expiresInDays: { type: 'integer', minimum: 1, maximum: 7 },
      },
    },
  })
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

  /** US02 — Métadonnées publiques d'un fichier. */
  @Get(':token')
  getMeta(@Param('token') token: string) {
    return this.filesService.getMetaByToken(token);
  }

  /** US02 — Téléchargement public (mot de passe si le fichier est protégé). */
  @Post(':token/download')
  @HttpCode(HttpStatus.OK)
  async download(
    @Param('token') token: string,
    @Body() dto: DownloadDto = {},
  ): Promise<StreamableFile> {
    const { stream, originalName, mimeType, size } =
      await this.filesService.prepareDownload(token, dto.password);

    return new StreamableFile(stream, {
      type: mimeType,
      length: size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    });
  }
}
