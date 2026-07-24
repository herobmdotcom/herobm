import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PaginationQuery } from '../common/pagination';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('ContactsController', () => {
  let controller: ContactsController;

  const mockUser: JwtUser = {
    userId: 'U001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockResult = {
    data: [{ contactId: 'C001', firstName: 'John', lastName: 'Doe' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    getContact: jest.fn().mockResolvedValue({
      contactId: 'C001',
      firstName: 'John',
      lastName: 'Doe',
    }),
    createContact: jest.fn().mockResolvedValue({
      contactId: 'C001',
      firstName: 'John',
      lastName: 'Doe',
    }),
    updateContact: jest.fn().mockResolvedValue({
      contactId: 'C001',
      firstName: 'John',
      lastName: 'Smith',
    }),
    deleteContact: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: mockService }],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const query: PaginationQuery = { page: 1, limit: 50 };
      const result = await controller.findAll(query);
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a contact by ID', async () => {
      const result = await controller.findOne('C001');
      expect(result).toEqual({
        contactId: 'C001',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(mockService.getContact).toHaveBeenCalledWith('C001');
    });
  });

  describe('create', () => {
    it('should create a contact', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        entityType: 'actor' as const,
        entityId: 'A001',
      };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual({
        contactId: 'C001',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(mockService.createContact).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });
  });

  describe('update', () => {
    it('should update a contact', async () => {
      const dto = { lastName: 'Smith' };
      const result = await controller.update('C001', dto, mockUser);
      expect(result).toEqual({
        contactId: 'C001',
        firstName: 'John',
        lastName: 'Smith',
      });
      expect(mockService.updateContact).toHaveBeenCalledWith(
        'C001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('remove', () => {
    it('should delete a contact', async () => {
      const result = await controller.remove('C001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.deleteContact).toHaveBeenCalledWith(
        'C001',
        mockUser.userId,
      );
    });
  });
});
