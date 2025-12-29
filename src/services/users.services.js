import logger from "#config/logger.js";
import { db } from "#config/database.js";
import { users } from "#models/schema.js";
import { eq } from "drizzle-orm";

export const getAllUsers = async () => {
  try {
    // Simple approach - select all fields
    const allUsers = await db.select().from(users);

    // Optionally exclude password
    return allUsers.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async (id) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (e) {
    if (e?.code === 'USER_NOT_FOUND') {
      throw e;
    }

    logger.error('Error getting user by id', e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(sanitizedUpdates).length === 0) {
      return existing;
    }

    sanitizedUpdates.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(sanitizedUpdates)
      .where(eq(users.id, id))
      .returning();

    const { password, ...userWithoutPassword } = updated;

    logger.info(`User ${userWithoutPassword.email} updated successfully.`, {
      id,
    });

    return userWithoutPassword;
  } catch (e) {
    if (e?.code === 'USER_NOT_FOUND') {
      throw e;
    }

    logger.error('Error updating user', e);
    throw e;
  }
};

export const deleteUser = async (id) => {
  try {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (!deleted) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    logger.info(`User ${deleted.email} deleted successfully.`, { id });

    const { password, ...userWithoutPassword } = deleted;
    return userWithoutPassword;
  } catch (e) {
    if (e?.code === 'USER_NOT_FOUND') {
      throw e;
    }

    logger.error('Error deleting user', e);
    throw e;
  }
};
