import { Test, TestingModule } from '@nestjs/testing';
import { ActorsController } from './actors.controller';
import { ActorsService } from './actors.service';
import { PaginationQuery } from '../common/pagination';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('ActorsController', () => {
  let controller: ActorsController;

  const mockUser: JwtUser = {
    userId: 'U001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockResult = {
    data: [{ actorId: 'A001', name: 'Actor One' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    getActors: jest.fn().mockResolvedValue(mockResult),
    getActor: jest
      .fn()
      .mockResolvedValue({ actorId: 'A001', name: 'Actor One' }),
    createActor: jest
      .fn()
      .mockResolvedValue({ actorId: 'A001', name: 'Actor One' }),
    updateActor: jest
      .fn()
      .mockResolvedValue({ actorId: 'A001', name: 'Actor Updated' }),
    deleteActor: jest.fn().mockResolvedValue({ success: true }),
    addContact: jest.fn().mockResolvedValue({ success: true }),
    updateContact: jest.fn().mockResolvedValue({ success: true }),
    removeContact: jest.fn().mockResolvedValue({ success: true }),
    addNote: jest.fn().mockResolvedValue({ noteId: 'N001' }),
    removeNote: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActorsController],
      providers: [{ provide: ActorsService, useValue: mockService }],
    }).compile();

    controller = module.get<ActorsController>(ActorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated actors', async () => {
      const query: PaginationQuery = { page: 1, limit: 50 };
      const result = await controller.findAll(query);
      expect(result).toEqual(mockResult);
      expect(mockService.getActors).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return an actor by ID', async () => {
      const result = await controller.findOne('A001');
      expect(result).toEqual({ actorId: 'A001', name: 'Actor One' });
      expect(mockService.getActor).toHaveBeenCalledWith('A001');
    });
  });

  describe('create', () => {
    it('should create an actor', async () => {
      const dto = { name: 'Actor One', legalStatus: 'company' as const };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual({ actorId: 'A001', name: 'Actor One' });
      expect(mockService.createActor).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });
  });

  describe('update', () => {
    it('should update an actor', async () => {
      const dto = { name: 'Actor Updated' };
      const result = await controller.update('A001', dto, mockUser);
      expect(result).toEqual({ actorId: 'A001', name: 'Actor Updated' });
      expect(mockService.updateActor).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('remove', () => {
    it('should delete an actor', async () => {
      const result = await controller.remove('A001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.deleteActor).toHaveBeenCalledWith(
        'A001',
        mockUser.userId,
      );
    });
  });

  describe('addContact', () => {
    it('should link a contact to an actor', async () => {
      const dto = { contactId: 'C001', role: 'admin' };
      const result = await controller.addContact('A001', dto, mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.addContact).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('updateContact', () => {
    it('should update a contact link', async () => {
      const dto = { role: 'user', primaryFor: [] };
      const result = await controller.updateContact(
        'A001',
        'C001',
        dto,
        mockUser,
      );
      expect(result).toEqual({ success: true });
      expect(mockService.updateContact).toHaveBeenCalledWith(
        'A001',
        'C001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('removeContact', () => {
    it('should remove a contact link', async () => {
      const result = await controller.removeContact('A001', 'C001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeContact).toHaveBeenCalledWith(
        'A001',
        'C001',
        mockUser.userId,
      );
    });
  });

  describe('addNote', () => {
    it('should add a note to an actor', async () => {
      const dto = { content: 'Test Note' };
      const result = await controller.addNote('A001', dto, mockUser);
      expect(result).toEqual({ noteId: 'N001' });
      expect(mockService.addNote).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('removeNote', () => {
    it('should remove a note from an actor', async () => {
      const result = await controller.removeNote('A001', 'N001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeNote).toHaveBeenCalledWith(
        'A001',
        'N001',
        mockUser.userId,
      );
    });
  });
});
