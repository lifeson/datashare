import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;

  // Document renvoyé par .save()
  const savedDoc = {
    _id: 'u1',
    email: 'claire@example.com',
    passwordHash: 'hash',
    name: 'Claire',
  };
  const modelInstance = { save: jest.fn().mockResolvedValue(savedDoc) };

  // Le modèle Mongoose est à la fois un constructeur (new Model()) et un objet
  // avec des méthodes statiques (findOne, findById).
  const UserModel: jest.Mock & {
    findOne: jest.Mock;
    findById: jest.Mock;
  } = Object.assign(
    jest.fn().mockImplementation(() => modelInstance),
    {
      findOne: jest.fn(),
      findById: jest.fn(),
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: UserModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it("normalise l'email (minuscule + trim) et enregistre le document", async () => {
      const result = await service.create({
        email: '  Claire@Example.COM ',
        passwordHash: 'hash',
        name: '  Claire  ',
      });

      expect(UserModel).toHaveBeenCalledWith({
        email: 'claire@example.com',
        passwordHash: 'hash',
        name: 'Claire',
      });
      expect(modelInstance.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(savedDoc);
    });

    it('laisse name à undefined si non fourni', async () => {
      await service.create({ email: 'a@b.c', passwordHash: 'h' });

      expect(UserModel).toHaveBeenCalledWith({
        email: 'a@b.c',
        passwordHash: 'h',
        name: undefined,
      });
    });
  });

  describe('findByEmail', () => {
    it('cherche par email normalisé', async () => {
      const exec = jest.fn().mockResolvedValue(null);
      UserModel.findOne.mockReturnValue({ exec });

      const result = await service.findByEmail('  Claire@Example.COM ');

      expect(UserModel.findOne).toHaveBeenCalledWith({
        email: 'claire@example.com',
      });
      expect(exec).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('délègue à Model.findById', async () => {
      const exec = jest.fn().mockResolvedValue(savedDoc);
      UserModel.findById.mockReturnValue({ exec });

      const result = await service.findById('u1');

      expect(UserModel.findById).toHaveBeenCalledWith('u1');
      expect(result).toBe(savedDoc);
    });
  });
});
