const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const { getUsers, createUser, updateUser, deleteUser, updateProfile, changePassword } = require('../controllers/userController');

// Protect all user routes (only authenticated users can access)
router.use(protect);

// Update user profile (any authenticated user can update their own profile)
router.put('/profile', updateProfile);

// Change user password (any authenticated user can change their own password)
router.put('/password', changePassword);

// Get all users (Admin only, permission check in controller)
router.get('/', getUsers);

// Create a new user (Admin only)
router.post('/', managerOrAdmin, createUser);

// Update a user by ID (Admin only)
router.put('/:id', managerOrAdmin, updateUser);

// Delete a user by ID (Admin only)
router.delete('/:id', managerOrAdmin, deleteUser);

module.exports = router;