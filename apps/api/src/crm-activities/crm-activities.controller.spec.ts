import { Test, TestingModule } from '@nestjs/testing';
import { CrmActivitiesController } from './crm-activities.controller';
import { CrmActivitiesService } from './crm-activities.service';
import type { JwtUser } from '../auth/auth-user.decorator';
import { EmptyBodyDto } from './dto';

describe('CrmActivitiesController', () => {
  let controller: CrmActivitiesController;

  const mockUser: JwtUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockActivity = {
    activityId: 'act-1',
    type: 'call' as const,
    subject: 'Client check-in',
    status: 'completed' as const,
    priority: 'medium' as const,
    createdById: mockUser.userId,
    createdBy: 'testuser',
    createdOn: new Date().toISOString(),
    modifiedOn: new Date().toISOString(),
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue({ data: [mockActivity], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockActivity),
    create: jest.fn().mockResolvedValue(mockActivity),
    update: jest
      .fn()
      .mockResolvedValue({ ...mockActivity, subject: 'Updated' }),
    complete: jest
      .fn()
      .mockResolvedValue({ ...mockActivity, status: 'completed' }),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrmActivitiesController],
      providers: [{ provide: CrmActivitiesService, useValue: mockService }],
    }).compile();

    controller = module.get<CrmActivitiesController>(CrmActivitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should query activities with filters', async () => {
      const query = { actorId: 'actor-1' };
      const res = await controller.findAll(query, mockUser);

      expect(mockService.findAll).toHaveBeenCalledWith(query, mockUser.userId);
      expect(res.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a single activity', async () => {
      const res = await controller.findOne('act-1');
      expect(mockService.findOne).toHaveBeenCalledWith('act-1');
      expect(res.activityId).toBe('act-1');
    });
  });

  describe('create', () => {
    it('should create an activity passing current user', async () => {
      const dto = {
        type: 'call' as const,
        subject: 'Client check-in',
        status: 'completed' as const,
        priority: 'medium' as const,
      };
      const res = await controller.create(dto, mockUser);
      expect(mockService.create).toHaveBeenCalledWith(dto, mockUser);
      expect(res.subject).toBe('Client check-in');
    });
  });

  describe('update', () => {
    it('should update an activity', async () => {
      const dto = { subject: 'Updated' };
      const res = await controller.update('act-1', dto, mockUser);
      expect(mockService.update).toHaveBeenCalledWith('act-1', dto, mockUser);
      expect(res.subject).toBe('Updated');
    });
  });

  describe('complete', () => {
    it('should complete a task', async () => {
      const res = await controller.complete(
        'act-1',
        new EmptyBodyDto(),
        mockUser,
      );
      expect(mockService.complete).toHaveBeenCalledWith('act-1', mockUser);
      expect(res.status).toBe('completed');
    });
  });

  describe('remove', () => {
    it('should remove an activity', async () => {
      const res = await controller.remove('act-1', mockUser);
      expect(mockService.remove).toHaveBeenCalledWith('act-1', mockUser);
      expect(res.success).toBe(true);
    });
  });
});
