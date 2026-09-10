import { IsOptional, IsString } from 'class-validator';

export class DownloadDto {
  /** Requis uniquement si le fichier est protégé par mot de passe. */
  @IsOptional()
  @IsString()
  password?: string;
}
