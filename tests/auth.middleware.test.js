import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock jwttoken.verify and logger used by the middleware
const mockVerify = jest.fn();

jest.unstable_mockModule('#utils/jwt.js', () => ({
  jwttoken: {
    verify: mockVerify,
  },
}));

jest.unstable_mockModule('#config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after setting up mocks so middleware sees the mocked modules
const { attachUser } = await import('../src/middleware/auth.middleware.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

describe('attachUser middleware', () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  it('1. attaches user from valid JWT in cookie', () => {
    const req = {
      cookies: { token: 'cookie-token' },
      get: jest.fn(),
    };
    const res = createMockRes();
    const next = createMockNext();

    const payload = { id: 1, email: 'user@example.com', role: 'admin' };
    mockVerify.mockReturnValue(payload);

    attachUser(req, res, next);

    expect(mockVerify).toHaveBeenCalledWith('cookie-token');
    expect(req.user).toEqual({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    expect(next).toHaveBeenCalled();
  });

  it('2. attaches user from valid JWT in Authorization header', () => {
    const req = {
      cookies: {},
      get: jest.fn().mockImplementation((header) => {
        if (header === 'Authorization') {
          return 'Bearer header-token';
        }
        return undefined;
      }),
    };
    const res = createMockRes();
    const next = createMockNext();

    const payload = { id: 2, email: 'header@example.com', role: 'user' };
    mockVerify.mockReturnValue(payload);

    attachUser(req, res, next);

    expect(mockVerify).toHaveBeenCalledWith('header-token');
    expect(req.user).toEqual({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    expect(next).toHaveBeenCalled();
  });

  it('3. leaves req.user undefined when no valid token is present', () => {
    const req = {
      cookies: {},
      get: jest.fn().mockReturnValue(undefined),
    };
    const res = createMockRes();
    const next = createMockNext();

    attachUser(req, res, next);

    expect(mockVerify).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('4. handles invalid or expired JWT gracefully', () => {
    const req = {
      cookies: { token: 'bad-token' },
      get: jest.fn(),
      path: '/test',
      method: 'GET',
    };
    const res = createMockRes();
    const next = createMockNext();

    mockVerify.mockImplementation(() => {
      throw new Error('Token invalid or expired');
    });

    expect(() => attachUser(req, res, next)).not.toThrow();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});