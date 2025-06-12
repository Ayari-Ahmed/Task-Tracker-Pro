const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

// Protect all user routes (only authenticated users can access)
router.use(protect);

// Get all users (Admin only, permission check in controller)
router.get('/', getUsers);

// Create a new user (Admin only)
router.post('/', managerOrAdmin, createUser);

// Update a user by ID (Admin only)
router.put('/:id', managerOrAdmin, updateUser);

// Delete a user by ID (Admin only)
router.delete('/:id', managerOrAdmin, deleteUser);

module.exports = router; 