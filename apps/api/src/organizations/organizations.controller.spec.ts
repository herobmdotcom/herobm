import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { PaginationQuery } from '../common/pagination';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  const mockUser: JwtUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockResult = {
    data: [{ organizationId: 'A001', name: 'Organization One' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    getOrganizations: jest.fn().mockResolvedValue(mockResult),
    getOrganization: jest
      .fn()
      .mockResolvedValue({ organizationId: 'A001', name: 'Organization One' }),
    createOrganization: jest
      .fn()
      .mockResolvedValue({ organizationId: 'A001', name: 'Organization One' }),
    updateOrganization: jest.fn().mockResolvedValue({
      organizationId: 'A001',
      name: 'Organization Updated',
    }),
    deleteOrganization: jest.fn().mockResolvedValue({ success: true }),
    addContact: jest.fn().mockResolvedValue({ success: true }),
    updateContact: jest.fn().mockResolvedValue({ success: true }),
    removeContact: jest.fn().mockResolvedValue({ success: true }),
    addNote: jest.fn().mockResolvedValue({ noteId: 'N001' }),
    removeNote: jest.fn().mockResolvedValue({ success: true }),
    getOrganizationLinks: jest.fn().mockResolvedValue([{ linkId: 'L001' }]),
    addOrganizationLink: jest.fn().mockResolvedValue({ linkId: 'L001' }),
    removeOrganizationLink: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: mockService }],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      const query: PaginationQuery = { page: 1, limit: 50 };
      const result = await controller.findAll(query);
      expect(result).toEqual(mockResult);
      expect(mockService.getOrganizations).toHaveBeenCalledWith(query);
    });

    it('should forward ownerId query filter to service', async () => {
      const query = { page: 1, limit: 50, ownerId: 'user-123' };
      await controller.findAll(query);
      expect(mockService.getOrganizations).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return an organization by ID', async () => {
      const result = await controller.findOne('A001');
      expect(result).toEqual({
        organizationId: 'A001',
        name: 'Organization One',
      });
      expect(mockService.getOrganization).toHaveBeenCalledWith('A001');
    });
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const dto = { name: 'Organization One', legalStatus: 'company' as const };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual({
        organizationId: 'A001',
        name: 'Organization One',
      });
      expect(mockService.createOrganization).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });

    it('should create an organization with ownerId', async () => {
      const dto = { name: 'Organization with Owner', ownerId: 'user-123' };
      await controller.create(dto, mockUser);
      expect(mockService.createOrganization).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      const dto = { name: 'Organization Updated' };
      const result = await controller.update('A001', dto, mockUser);
      expect(result).toEqual({
        organizationId: 'A001',
        name: 'Organization Updated',
      });
      expect(mockService.updateOrganization).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });

    it('should update an organization with ownerId or unassign', async () => {
      const dto = { ownerId: 'user-456' };
      await controller.update('A001', dto, mockUser);
      expect(mockService.updateOrganization).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('remove', () => {
    it('should delete an organization', async () => {
      const result = await controller.remove('A001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.deleteOrganization).toHaveBeenCalledWith(
        'A001',
        mockUser.userId,
      );
    });
  });

  describe('addContact', () => {
    it('should link a contact to an organization', async () => {
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
    it('should add a note to an organization', async () => {
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
    it('should remove a note from an organization', async () => {
      const result = await controller.removeNote('A001', 'N001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeNote).toHaveBeenCalledWith(
        'A001',
        'N001',
        mockUser.userId,
      );
    });
  });

  describe('links', () => {
    it('should get organization links', async () => {
      const result = await controller.getLinks('A001');
      expect(result).toEqual([{ linkId: 'L001' }]);
      expect(mockService.getOrganizationLinks).toHaveBeenCalledWith('A001');
    });

    it('should add organization link', async () => {
      const dto = {
        targetOrganizationId: 'A002',
        linkType: 'subsidiary' as const,
      };
      const result = await controller.addLink('A001', dto, mockUser);
      expect(result).toEqual({ linkId: 'L001' });
      expect(mockService.addOrganizationLink).toHaveBeenCalledWith(
        'A001',
        dto,
        mockUser.userId,
      );
    });

    it('should remove organization link', async () => {
      const result = await controller.removeLink('A001', 'L001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeOrganizationLink).toHaveBeenCalledWith(
        'A001',
        'L001',
        mockUser.userId,
      );
    });
  });
});
