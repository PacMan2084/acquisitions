import express from 'express';
import {
  fetchAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "#controllers/users.controller.js";

const router = express.Router();

// GET /api/users - list all users
router.get('/', fetchAllUsers);

// GET /api/users/:id - get a single user by id
router.get('/:id', getUserById);

// PUT /api/users/:id - update a user
router.put('/:id', updateUser);

// DELETE /api/users/:id - delete a user
router.delete('/:id', deleteUser);

export default router;
