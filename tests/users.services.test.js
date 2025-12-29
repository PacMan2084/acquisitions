import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

// Simple users table stub
const mockUsersTable = {};

jest.unstable_mockModule('#models/schema.js', () => ({
  users: mockUsersTable,
}));

jest.unstable_mockModule('#config/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('#config/database.js', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = await import('../src/services/users.services.js');

const createSelectChain = (resultArray) => {
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(resultArray),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
};

const createUpdateChain = (resultArray) => {
  const chain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resultArray),
  };
  mockUpdate.mockReturnValue(chain);
  return chain;
};

const createDeleteChain = (resultArray) => {
  const chain = {
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resultArray),
  };
  mockDelete.mockReturnValue(chain);
  return chain;
};

describe('users.services', () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it('getAllUsers should return users without password field', async () => {
    const users = [
      { id: 1, email: 'one@example.com', password: 'hash1' },
      { id: 2, email: 'two@example.com', password: 'hash2' },
    ];

    const chain = {
      from: jest.fn().mockResolvedValue(users),
    };
    mockSelect.mockReturnValue(chain);

    const result = await getAllUsers();

    expect(mockSelect).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith(mockUsersTable);
    expect(result).toEqual([
      { id: 1, email: 'one@example.com' },
      { id: 2, email: 'two@example.com' },
    ]);
  });

  it('getUserById should return user without password when found', async () => {
    const user = { id: 1, email: 'one@example.com', password: 'hash' };
    createSelectChain([user]);

    const result = await getUserById(1);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, email: 'one@example.com' });
  });

  it('getUserById should throw USER_NOT_FOUND when user does not exist', async () => {
    createSelectChain([]);

    await expect(getUserById(1)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('updateUser should update existing user and return sanitized result', async () => {
    const existing = { id: 1, email: 'old@example.com', password: 'hash' };
    createSelectChain([existing]);

    const updated = { id: 1, email: 'new@example.com', password: 'hash' };
    const updateChain = createUpdateChain([updated]);

    const result = await updateUser(1, { email: 'new@example.com' });

    expect(mockUpdate).toHaveBeenCalledWith(mockUsersTable);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', updatedAt: expect.any(Date) })
    );
    expect(result).toEqual({ id: 1, email: 'new@example.com' });
  });

  it('updateUser should throw USER_NOT_FOUND when user does not exist', async () => {
    createSelectChain([]);

    await expect(updateUser(1, { email: 'x@example.com' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('updateUser should return existing user when no updates provided', async () => {
    const existing = { id: 1, email: 'same@example.com', password: 'hash' };
    createSelectChain([existing]);

    const result = await updateUser(1, { email: undefined });

    expect(result).toBe(existing);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('deleteUser should delete user and return sanitized result', async () => {
    const deleted = { id: 1, email: 'gone@example.com', password: 'hash' };
    const deleteChain = createDeleteChain([deleted]);

    const result = await deleteUser(1);

    expect(mockDelete).toHaveBeenCalledWith(mockUsersTable);
    expect(deleteChain.where).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, email: 'gone@example.com' });
  });

  it('deleteUser should throw USER_NOT_FOUND when user does not exist', async () => {
    createDeleteChain([]);

    await expect(deleteUser(1)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
