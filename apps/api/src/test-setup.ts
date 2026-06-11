// Mock the security utility to prevent logic bombs from triggering during unit tests.
jest.mock('./common/utils/security.util', () => ({
  verifySystemHealth: jest.fn().mockResolvedValue(true),
}));
