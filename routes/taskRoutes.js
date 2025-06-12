const express = require('express');
const router = express.Router();
const { 
  getTasks, 
  getTask, 
  createTask, 
  updateTask, 
  deleteTask, 
  addComment, 
  updateStatus, 
  getTaskStats 
} = require('../controllers/taskController');
const { 
  protect, 
  managerOrAdmin,
  projectMemberOrAdmin 
} = require('../middleware/auth');

// All task routes require authentication
router.use(protect);

// Get task statistics for dashboard
router.get('/stats', getTaskStats);

// Get all tasks (filtered by user role/access)
router.get('/', getTasks);

// Get single task details
router.get('/:id', getTask);

// Create new task
router.post('/', createTask);

// Update task
router.put('/:id', updateTask);

// Update task status
router.patch('/:id/status', updateStatus);

// Delete task (project manager or admin only)
router.delete('/:id', managerOrAdmin, deleteTask);

// Add comment to task
router.post('/:id/comments', addComment);

module.exports = router;