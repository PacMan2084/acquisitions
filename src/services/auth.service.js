import logger from '#config/logger.js';
import bcrypt from 'bcrypt';
import { users } from '#models/user.model.js';
import { db } from '#config/database.js';
import { eq } from 'drizzle-orm';

export const hashPassword = async password => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (e) {
    logger.error(`Error hashing the password: ${e}`);
    throw new Error('Error hashing');
  }
};

export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (e) {
    logger.error(`Error comparing the password: ${e}`);
    throw new Error('Error comparing password');
  }
};

export const authenticateUser = async (email, password) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Never return the password hash to callers.
    // eslint-disable-next-line no-unused-vars
    const { password: _password, ...safeUser } = user;

    return safeUser;
  } catch (e) {
    // Expected auth failures shouldn't spam error logs.
    if (e?.code === 'USER_NOT_FOUND' || e?.code === 'INVALID_CREDENTIALS') {
      throw e;
    }

    logger.error('Error authenticating the user', e);
    throw e;
  }
};

export const creatUser = async ({ name, email, password, role = 'user' }) => {
  try {
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      const err = new Error('User already exists');
      err.code = 'USER_EXISTS';
      throw err;
    }

    const password_hash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({ name, email, password: password_hash, role })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        created_at: users.created_at,
      });

    logger.info(`User ${newUser.email} created successfully.`);
    return newUser;
  } catch (e) {
    logger.error(`Error creating the user: ${e}`);
    throw e;
  }
};
