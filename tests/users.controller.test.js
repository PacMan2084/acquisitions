import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Create shared mock functions so we can both inject and assert on them
const mockGetAllUsers = jest.fn();
const mockGetUserById = jest.fn();
const mockUpdateUser = jest.fn();
const mockDeleteUser = jest.fn();

// ESM-safe module mocking using unstable_mockModule
jest.unstable_mockModule('#services/users.services.js', () => ({
  getAllUsers: mockGetAllUsers,
  getUserById: mockGetUserById,
  updateUser: mockUpdateUser,
  deleteUser: mockDeleteUser,
}));

jest.unstable_mockModule('#config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after setting up mocks so controllers see the mocked modules
const {
  fetchAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = await import('../src/controllers/users.controller.js');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('Users Controller', () => {
  beforeEach(() => {
    mockGetAllUsers.mockReset();
    mockGetUserById.mockReset();
    mockUpdateUser.mockReset();
    mockDeleteUser.mockReset();
  });

  it('1. fetchAllUsers should return all users with count', async () => {
    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    const users = [
      { id: 1, name: 'User One', email: 'one@example.com' },
      { id: 2, name: 'User Two', email: 'two@example.com' },
    ];

    mockGetAllUsers.mockResolvedValue(users);

    await fetchAllUsers(req, res, next);

    expect(mockGetAllUsers).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'Successfully retrieved users.',
      users,
      count: users.length,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('2. getUserById should return a user when a valid id is provided', async () => {
    const req = { params: { id: '1' } };
    const res = createMockRes();
    const next = jest.fn();

    const user = { id: 1, name: 'User One', email: 'one@example.com' };

    mockGetUserById.mockResolvedValue(user);

    await getUserById(req, res, next);

    expect(mockGetUserById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Successfully retrieved user.',
      user,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('3. getUserById should return 400 for invalid id format', async () => {
    const req = { params: { id: 'abc' } };
    const res = createMockRes();
    const next = jest.fn();

    await getUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('4. getUserById should return 404 when user is not found', async () => {
    const req = { params: { id: '1' } };
    const res = createMockRes();
    const next = jest.fn();

    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';

    mockGetUserById.mockRejectedValue(error);

    await getUserById(req, res, next);

    expect(mockGetUserById).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('5. updateUser should allow a user to update their own profile (non-role fields)', async () => {
    const req = {
      params: { id: '1' },
      body: { name: 'New Name', email: 'new@example.com' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    const updated = { id: 1, name: 'New Name', email: 'new@example.com' };
    mockUpdateUser.mockResolvedValue(updated);

    await updateUser(req, res, next);

    expect(mockUpdateUser).toHaveBeenCalledWith(1, {
      name: 'New Name',
      email: 'new@example.com',
    });
    expect(res.json).toHaveBeenCalledWith({
      message: 'User updated successfully.',
      user: updated,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('6. updateUser should block non-admin users from updating others', async () => {
    const req = {
      params: { id: '2' },
      body: { name: 'Hacker' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    await updateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'You can only update your own user account',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('7. updateUser should block non-admin users from changing role', async () => {
    const req = {
      params: { id: '1' },
      body: { role: 'admin' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    await updateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Only admin users can change roles',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('8. updateUser should allow an admin user to update the role of any user', async () => {
    const req = {
      params: { id: '2' },
      body: { role: 'admin' },
      user: { id: 1, role: 'admin' },
    };
    const res = createMockRes();
    const next = jest.fn();

    const updated = { id: 2, name: 'User Two', email: 'two@example.com', role: 'admin' };
    mockUpdateUser.mockResolvedValue(updated);

    await updateUser(req, res, next);

    expect(mockUpdateUser).toHaveBeenCalledWith(2, { role: 'admin' });
    expect(res.json).toHaveBeenCalledWith({
      message: 'User updated successfully.',
      user: updated,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('9. deleteUser should allow a user to delete their own account', async () => {
    const req = {
      params: { id: '1' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    mockDeleteUser.mockResolvedValue(undefined);

    await deleteUser(req, res, next);

    expect(mockDeleteUser).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User deleted successfully.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('9. deleteUser should block non-admin users from deleting others', async () => {
    const req = {
      params: { id: '2' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    await deleteUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'You can only delete your own user account',
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('10. deleteUser should allow admin users to delete any account', async () => {
    const req = {
      params: { id: '2' },
      user: { id: 1, role: 'admin' },
    };
    const res = createMockRes();
    const next = jest.fn();

    mockDeleteUser.mockResolvedValue(undefined);

    await deleteUser(req, res, next);

    expect(mockDeleteUser).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User deleted successfully.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('11. deleteUser should return 404 when user is not found', async () => {
    const req = {
      params: { id: '1' },
      user: { id: 1, role: 'user' },
    };
    const res = createMockRes();
    const next = jest.fn();

    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';

    mockDeleteUser.mockRejectedValue(error);

    await deleteUser(req, res, next);

    expect(mockDeleteUser).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });
});
