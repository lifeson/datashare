import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** Adresse email du compte. */
  @IsEmail()
  email: string;

  /** Mot de passe en clair. */
  @IsString()
  @IsNotEmpty()
  password: string;
}
