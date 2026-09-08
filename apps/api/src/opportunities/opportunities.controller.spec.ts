import { Test, TestingModule } from '@nestjs/testing';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('OpportunitiesController', () => {
  let controller: OpportunitiesController;

  const mockUser: JwtUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockResult = [{ opportunityId: 'O001', name: 'Opportunity Alpha' }];

  const mockService = {
    getOpportunities: jest.fn().mockResolvedValue(mockResult),
    getOpportunity: jest
      .fn()
      .mockResolvedValue({ opportunityId: 'O001', name: 'Opportunity Alpha' }),
    createOpportunity: jest
      .fn()
      .mockResolvedValue({ opportunityId: 'O001', name: 'Opportunity Alpha' }),
    updateOpportunity: jest
      .fn()
      .mockResolvedValue({ opportunityId: 'O001', name: 'Opportunity Beta' }),
    deleteOpportunity: jest.fn().mockResolvedValue({ success: true }),
    addOpportunityNote: jest.fn().mockResolvedValue({ noteId: 'N001' }),
    getOpportunityNotes: jest.fn().mockResolvedValue([]),
    addOpportunityContact: jest.fn().mockResolvedValue({ success: true }),
    updateOpportunityContact: jest.fn().mockResolvedValue({ success: true }),
    deleteOpportunityContact: jest.fn().mockResolvedValue({ success: true }),
    addOpportunityOrganization: jest.fn().mockResolvedValue({ success: true }),
    updateOpportunityOrganization: jest
      .fn()
      .mockResolvedValue({ success: true }),
    deleteOpportunityOrganization: jest
      .fn()
      .mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpportunitiesController],
      providers: [{ provide: OpportunitiesService, useValue: mockService }],
    }).compile();

    controller = module.get<OpportunitiesController>(OpportunitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all opportunities', async () => {
      const result = await controller.findAll({} as any);
      expect(result).toEqual(mockResult);
      expect(mockService.getOpportunities).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an opportunity by ID', async () => {
      const result = await controller.findOne('O001');
      expect(result).toEqual({
        opportunityId: 'O001',
        name: 'Opportunity Alpha',
      });
      expect(mockService.getOpportunity).toHaveBeenCalledWith('O001');
    });
  });

  describe('create', () => {
    it('should create an opportunity', async () => {
      const dto = { name: 'Opportunity Alpha', type: 'commercial' };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual({
        opportunityId: 'O001',
        name: 'Opportunity Alpha',
      });
      expect(mockService.createOpportunity).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });
  });

  describe('update', () => {
    it('should update an opportunity', async () => {
      const dto = { name: 'Opportunity Beta' };
      const result = await controller.update('O001', dto, mockUser);
      expect(result).toEqual({
        opportunityId: 'O001',
        name: 'Opportunity Beta',
      });
      expect(mockService.updateOpportunity).toHaveBeenCalledWith(
        'O001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('remove', () => {
    it('should delete an opportunity', async () => {
      const result = await controller.remove('O001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.deleteOpportunity).toHaveBeenCalledWith(
        'O001',
        mockUser.userId,
      );
    });
  });

  describe('contacts', () => {
    it('should add a contact', async () => {
      const dto = { contactId: 'C001', roles: ['decision_maker'] };
      const res = await controller.addContact('O001', dto, mockUser);
      expect(mockService.addOpportunityContact).toHaveBeenCalledWith(
        'O001',
        dto,
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });

    it('should update contact roles with PATCH', async () => {
      const dto = { roles: ['influencer'] };
      const res = await controller.updateContact('O001', 'C001', dto, mockUser);
      expect(mockService.updateOpportunityContact).toHaveBeenCalledWith(
        'O001',
        'C001',
        dto,
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });

    it('should delete a contact link', async () => {
      const res = await controller.deleteContact('O001', 'C001', mockUser);
      expect(mockService.deleteOpportunityContact).toHaveBeenCalledWith(
        'O001',
        'C001',
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });
  });

  describe('organizations', () => {
    it('should add an organization', async () => {
      const dto = { organizationId: 'ORG001', roles: ['contractor'] };
      const res = await controller.addOrganization('O001', dto, mockUser);
      expect(mockService.addOpportunityOrganization).toHaveBeenCalledWith(
        'O001',
        dto,
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });

    it('should update organization roles with PATCH', async () => {
      const dto = { roles: ['partner'] };
      const res = await controller.updateOrganization(
        'O001',
        'ORG001',
        dto,
        mockUser,
      );
      expect(mockService.updateOpportunityOrganization).toHaveBeenCalledWith(
        'O001',
        'ORG001',
        dto,
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });

    it('should delete an organization link', async () => {
      const res = await controller.deleteOrganization(
        'O001',
        'ORG001',
        mockUser,
      );
      expect(mockService.deleteOpportunityOrganization).toHaveBeenCalledWith(
        'O001',
        'ORG001',
        mockUser.userId,
      );
      expect(res).toEqual({ success: true });
    });
  });
});
