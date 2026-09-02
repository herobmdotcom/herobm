import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('UserSettingsController', () => {
  let controller: UserSettingsController;

  const mockUser: JwtUser = {
    userId: '00000000-0000-0000-0000-000000000099',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  };

  const mockSettingsResponse = {
    userId: '00000000-0000-0000-0000-000000000099',
    dashboardConfig: {},
    reportConfigs: {},
    preferences: { density: 'comfortable' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockService = {
    getSettings: jest.fn().mockResolvedValue(mockSettingsResponse),
    updateSettings: jest.fn().mockResolvedValue({
      ...mockSettingsResponse,
      preferences: { density: 'compact' },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserSettingsController],
      providers: [{ provide: UserSettingsService, useValue: mockService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserSettingsController>(UserSettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getSettings delegates to service with current user id', async () => {
    const result = await controller.getSettings(mockUser);
    expect(mockService.getSettings).toHaveBeenCalledWith(mockUser.userId);
    expect(result).toEqual(mockSettingsResponse);
  });

  it('updateSettings delegates to service with current user id and update body', async () => {
    const body = { preferences: { density: 'compact' as const } };
    const result = await controller.updateSettings(mockUser, body);
    expect(mockService.updateSettings).toHaveBeenCalledWith(
      mockUser.userId,
      body,
    );
    expect(result.preferences).toEqual({ density: 'compact' });
  });
});
