import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  const mockUser: JwtUser = {
    userId: 'U001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockResult = [{ projectId: 'P001', name: 'Project Alpha' }];

  const mockService = {
    getProjects: jest.fn().mockResolvedValue(mockResult),
    getProject: jest
      .fn()
      .mockResolvedValue({ projectId: 'P001', name: 'Project Alpha' }),
    createProject: jest
      .fn()
      .mockResolvedValue({ projectId: 'P001', name: 'Project Alpha' }),
    updateProject: jest
      .fn()
      .mockResolvedValue({ projectId: 'P001', name: 'Project Beta' }),
    deleteProject: jest.fn().mockResolvedValue({ success: true }),
    addNote: jest.fn().mockResolvedValue({ noteId: 'N001' }),
    removeNote: jest.fn().mockResolvedValue({ success: true }),
    addContact: jest.fn().mockResolvedValue({ success: true }),
    updateContact: jest.fn().mockResolvedValue({ success: true }),
    removeContact: jest.fn().mockResolvedValue({ success: true }),
    addActor: jest.fn().mockResolvedValue({ success: true }),
    removeActor: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: mockService }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockResult);
      expect(mockService.getProjects).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a project by ID', async () => {
      const result = await controller.findOne('P001');
      expect(result).toEqual({ projectId: 'P001', name: 'Project Alpha' });
      expect(mockService.getProject).toHaveBeenCalledWith('P001');
    });
  });

  describe('create', () => {
    it('should create a project', async () => {
      const dto = { name: 'Project Alpha', type: 'internal' as const };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual({ projectId: 'P001', name: 'Project Alpha' });
      expect(mockService.createProject).toHaveBeenCalledWith(
        dto,
        mockUser.userId,
      );
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const dto = { name: 'Project Beta' };
      const result = await controller.update('P001', dto, mockUser);
      expect(result).toEqual({ projectId: 'P001', name: 'Project Beta' });
      expect(mockService.updateProject).toHaveBeenCalledWith(
        'P001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('addNote', () => {
    it('should add a note to a project', async () => {
      const dto = { content: 'Project Note' };
      const result = await controller.addNote('P001', dto, mockUser);
      expect(result).toEqual({ noteId: 'N001' });
      expect(mockService.addNote).toHaveBeenCalledWith(
        'P001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('removeNote', () => {
    it('should delete a note from a project', async () => {
      const result = await controller.removeNote('P001', 'N001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeNote).toHaveBeenCalledWith(
        'P001',
        'N001',
        mockUser.userId,
      );
    });
  });

  describe('addContact', () => {
    it('should add a contact to a project', async () => {
      const dto = { contactId: 'C001', roles: ['manager'] };
      const result = await controller.addContact('P001', dto, mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.addContact).toHaveBeenCalledWith(
        'P001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('updateContact', () => {
    it('should update a project contact', async () => {
      const dto = { roles: ['lead'] };
      const result = await controller.updateContact(
        'P001',
        'C001',
        dto,
        mockUser,
      );
      expect(result).toEqual({ success: true });
      expect(mockService.updateContact).toHaveBeenCalledWith(
        'P001',
        'C001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('removeContact', () => {
    it('should remove a contact from a project', async () => {
      const result = await controller.removeContact('P001', 'C001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeContact).toHaveBeenCalledWith(
        'P001',
        'C001',
        mockUser.userId,
      );
    });
  });

  describe('addActor', () => {
    it('should add an actor to a project', async () => {
      const dto = { actorId: 'A001', roles: ['contractor'] };
      const result = await controller.addActor('P001', dto, mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.addActor).toHaveBeenCalledWith(
        'P001',
        dto,
        mockUser.userId,
      );
    });
  });

  describe('removeActor', () => {
    it('should remove an actor from a project', async () => {
      const result = await controller.removeActor('P001', 'A001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.removeActor).toHaveBeenCalledWith(
        'P001',
        'A001',
        mockUser.userId,
      );
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const result = await controller.remove('P001', mockUser);
      expect(result).toEqual({ success: true });
      expect(mockService.deleteProject).toHaveBeenCalledWith(
        'P001',
        mockUser.userId,
      );
    });
  });
});
