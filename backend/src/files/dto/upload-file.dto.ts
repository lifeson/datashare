import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Champs texte du formulaire multipart (le fichier lui-même est géré par
 * l'intercepteur). Les valeurs arrivent en chaîne → `@Type` convertit.
 */
export class UploadFileDto {
  /** Mot de passe optionnel protégeant le téléchargement (min. 6 caractères). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  /** Durée de validité du lien, en jours (1 à 7, défaut 7). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  expiresInDays?: number;
}
