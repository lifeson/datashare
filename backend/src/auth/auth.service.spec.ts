import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/schemas/user.schema';

/** Fabrique un faux document utilisateur. */
function fakeUser(
  overrides: Partial<Record<string, unknown>> = {},
): UserDocument {
  const id = new Types.ObjectId();
  return {
    _id: id,
    email: 'claire@example.com',
    passwordHash: '$2b$12$fakehash',
    name: 'Claire',
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
    ...overrides,
  } as unknown as UserDocument;
}

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register (US03)', () => {
    const dto = {
      email: 'claire@example.com',
      password: 'motdepasse8',
      name: 'Claire',
    };

    it('crée le compte et renvoie { accessToken, user }', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = fakeUser();
      usersService.create.mockResolvedValue(created);

      const result = await service.register(dto);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: created._id.toString(),
        email: 'claire@example.com',
        name: 'Claire',
        createdAt: created.createdAt,
      });
    });

    it('signe un JWT avec le payload { sub, email } (C4)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = fakeUser();
      usersService.create.mockResolvedValue(created);

      await service.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: created._id.toString(),
        email: 'claire@example.com',
      });
    });

    it('hache le mot de passe avant enregistrement — jamais en clair (C1)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      let passedHash = '';
      usersService.create.mockImplementation(
        (data: { passwordHash: string }) => {
          passedHash = data.passwordHash;
          return Promise.resolve(fakeUser({ passwordHash: data.passwordHash }));
        },
      );

      await service.register(dto);

      expect(passedHash).not.toBe(dto.password);
      expect(passedHash).toMatch(/^\$2[aby]\$/); // format bcrypt
      await expect(bcrypt.compare(dto.password, passedHash)).resolves.toBe(
        true,
      );
    });

    it('ne renvoie jamais le passwordHash dans la réponse (C1)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(fakeUser());

      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it("rejette avec 409 si l'email est déjà utilisé (C2)", async () => {
      usersService.findByEmail.mockResolvedValue(fakeUser());

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });
});
