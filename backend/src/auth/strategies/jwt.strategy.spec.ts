import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const usersService = { findById: jest.fn() };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const payload: JwtPayload = { sub: 'user-1', email: 'claire@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(config, usersService as unknown as UsersService);
  });

  it("renvoie { userId, email } si l'utilisateur du token existe (C6)", async () => {
    usersService.findById.mockResolvedValue({ _id: 'user-1' });

    const result = await strategy.validate(payload);

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ userId: 'user-1', email: 'claire@example.com' });
  });

  it("rejette avec 401 si l'utilisateur n'existe plus (C6)", async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
