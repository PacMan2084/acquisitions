import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Create shared mock functions so we can both inject and assert on them
const mockCreatUser = jest.fn();
const mockAuthenticateUser = jest.fn();
const mockJwtSign = jest.fn();
const mockCookiesSet = jest.fn();
const mockCookiesClear = jest.fn();

// ESM-safe module mocking using unstable_mockModule
jest.unstable_mockModule('#services/auth.service.js', () => ({
  creatUser: mockCreatUser,
  authenticateUser: mockAuthenticateUser,
}));

jest.unstable_mockModule('#utils/jwt.js', () => ({
  jwttoken: {
    sign: mockJwtSign,
  },
}));

jest.unstable_mockModule('#utils/cookies.js', () => ({
  cookies: {
    set: mockCookiesSet,
    clear: mockCookiesClear,
    get: jest.fn(),
  },
}));

jest.unstable_mockModule('#config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after setting up mocks so controllers see the mocked modules
const { signup, signin, signout } = await import('../src/controllers/auth.controller.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth Controller', () => {
  beforeEach(() => {
    mockCreatUser.mockReset();
    mockAuthenticateUser.mockReset();
    mockJwtSign.mockReset();
    mockCookiesSet.mockReset();
    mockCookiesClear.mockReset();
  });

  it('1. User registration with valid data should create a new user and set a JWT cookie', async () => {
    const req = {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'user',
      },
    };
    const res = createMockRes();
    const next = jest.fn();

    const fakeUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
    };

    mockCreatUser.mockResolvedValue(fakeUser);
    mockJwtSign.mockReturnValue('fake-jwt-token');

    await signup(req, res, next);

    expect(mockCreatUser).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      role: 'user',
    });

    expect(mockJwtSign).toHaveBeenCalledWith({
      id: fakeUser.id,
      email: fakeUser.email,
      role: fakeUser.role,
    });

    // cookies.set should be called with the generated token
    expect(mockCookiesSet).toHaveBeenCalledWith(res, 'token', 'fake-jwt-token');

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User registered successfully',
      user: fakeUser,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('2. User registration with an existing email should return a conflict error', async () => {
    const req = {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'user',
      },
    };
    const res = createMockRes();
    const next = jest.fn();

    const error = new Error('User already exists');
    error.code = 'USER_EXISTS';

    mockCreatUser.mockRejectedValue(error);

    await signup(req, res, next);

    expect(mockCreatUser).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already exists' });
    expect(next).not.toHaveBeenCalled();
  });

  it('3. User login with correct credentials should return a JWT cookie', async () => {
    const req = {
      body: {
        email: 'john@example.com',
        password: 'password123',
      },
    };
    const res = createMockRes();
    const next = jest.fn();

    const fakeUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
    };

    mockAuthenticateUser.mockResolvedValue(fakeUser);
    mockJwtSign.mockReturnValue('fake-jwt-token');

    await signin(req, res, next);

    expect(mockAuthenticateUser).toHaveBeenCalledWith('john@example.com', 'password123');

    expect(mockJwtSign).toHaveBeenCalledWith({
      id: fakeUser.id,
      email: fakeUser.email,
      role: fakeUser.role,
    });

    expect(mockCookiesSet).toHaveBeenCalledWith(res, 'token', 'fake-jwt-token');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User signed in successfully',
      user: fakeUser,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('4. User login with incorrect credentials should return an unauthorized error', async () => {
    const req = {
      body: {
        email: 'john@example.com',
        password: 'wrongpassword',
      },
    };
    const res = createMockRes();
    const next = jest.fn();

    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';

    mockAuthenticateUser.mockRejectedValue(error);

    await signin(req, res, next);

    expect(mockAuthenticateUser).toHaveBeenCalledWith('john@example.com', 'wrongpassword');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    expect(next).not.toHaveBeenCalled();
  });

  it('5. User logout should clear the authentication cookie', async () => {
    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    await signout(req, res, next);

    expect(mockCookiesClear).toHaveBeenCalledWith(res, 'token');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'User signed out successfully' });
    expect(next).not.toHaveBeenCalled();
  });
});
