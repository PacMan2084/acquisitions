import logger from "#config/logger.js";
import {
  getAllUsers,
  getUserById as getUserByIdService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from "#services/users.services.js";
import { userIdSchema, updateUserSchema } from "#validations/users.validation.js";
import { formatValidationError } from "#utils/format.js";

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting users...');

    const allusers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved users.',
      users: allusers,
      count: allusers.length,
    });
  } catch (e) {
    logger.error(e);
    next(e);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      logger.warn('Invalid user id provided', {
        errors: validationResult.error?.issues,
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    logger.info(`Fetching user by id: ${id}`);

    const user = await getUserByIdService(id);

    return res.json({
      message: 'Successfully retrieved user.',
      user,
    });
  } catch (e) {
    if (e.code === 'USER_NOT_FOUND') {
      logger.warn('User not found', { id: req.params?.id });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.error(e);
    next(e);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const idResult = userIdSchema.safeParse(req.params);
    if (!idResult.success) {
      logger.warn('Invalid user id provided for update', {
        errors: idResult.error?.issues,
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idResult.error),
      });
    }

    const bodyResult = updateUserSchema.safeParse(req.body);
    if (!bodyResult.success) {
      logger.warn('Invalid update payload for user', {
        errors: bodyResult.error?.issues,
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(bodyResult.error),
      });
    }

    const { id } = idResult.data;
    const updates = bodyResult.data;

    const currentUser = req.user;

    if (!currentUser) {
      logger.warn('Unauthenticated update user attempt', { id });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requesterId = Number(currentUser.id);
    const isSelf = requesterId === id;

    if (!isSelf && currentUser.role !== 'admin') {
      logger.warn('Non-admin user attempted to update another user', {
        id,
        requesterId,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own user account',
      });
    }

    if (updates.role && currentUser.role !== 'admin') {
      logger.warn('Non-admin user attempted to change role', {
        id,
        requesterId,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin users can change roles',
      });
    }

    logger.info('Updating user', {
      id,
      requesterId,
      fields: Object.keys(updates),
    });

    const updatedUser = await updateUserService(id, updates);

    return res.json({
      message: 'User updated successfully.',
      user: updatedUser,
    });
  } catch (e) {
    if (e.code === 'USER_NOT_FOUND') {
      logger.warn('User not found for update', { id: req.params?.id });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.error(e);
    next(e);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      logger.warn('Invalid user id provided for delete', {
        errors: validationResult.error?.issues,
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    const currentUser = req.user;

    if (!currentUser) {
      logger.warn('Unauthenticated delete user attempt', { id });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requesterId = Number(currentUser.id);
    const isSelf = requesterId === id;

    if (!isSelf && currentUser.role !== 'admin') {
      logger.warn('Non-admin user attempted to delete another user', {
        id,
        requesterId,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own user account',
      });
    }

    logger.info('Deleting user', { id, requesterId });

    await deleteUserService(id);

    return res.json({
      message: 'User deleted successfully.',
    });
  } catch (e) {
    if (e.code === 'USER_NOT_FOUND') {
      logger.warn('User not found for delete', { id: req.params?.id });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.error(e);
    next(e);
  }
};
