import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** Nombre de tours bcrypt (coût). */
export const BCRYPT_ROUNDS = 12;

/**
 * Hash factice comparé lorsqu'aucun compte ne correspond à l'email fourni,
 * afin d'égaliser le temps de réponse et de limiter l'énumération de comptes.
 */
const DUMMY_HASH =
  '$2b$12$jLoChfI38aA/M0x9XQxuA.Qfq9KM5nqszovhBQhWAxLJnPa8nqq7a';

/** Représentation d'un utilisateur exposée par l'API (jamais le hash). */
export interface PublicUser {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** US03 — Création de compte. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.buildAuthResult(user);
  }

  /** US04 — Connexion. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    // Même erreur et même message que l'email soit inconnu ou le mot de passe faux.
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    return this.buildAuthResult(user);
  }

  /** Profil de l'utilisateur authentifié (route /auth/me). */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  /** Construit la réponse { accessToken, user } pour un utilisateur donné. */
  async buildAuthResult(user: UserDocument): Promise<AuthResult> {
    const publicUser = this.toPublicUser(user);
    const payload: JwtPayload = { sub: publicUser.id, email: publicUser.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: publicUser };
  }

  /** Mappe un document Mongo vers la vue publique (sans passwordHash). */
  toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
