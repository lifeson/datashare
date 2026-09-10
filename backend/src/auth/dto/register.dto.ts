import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  /** Adresse email unique du compte. */
  @IsEmail()
  email: string;

  /** Mot de passe en clair, 8 caractères minimum. */
  @IsString()
  @MinLength(8)
  password: string;

  /** Nom d'affichage facultatif (max 60 caractères). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}
