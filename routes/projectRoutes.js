const express = require('express');
const router = express.Router();
const { 
  getProjects, 
  getProject, 
  createProject, 
  updateProject, 
  deleteProject, 
  addTeamMember,
  removeTeamMember,
  getProjectStats 
} = require('../controllers/projectController');
const { 
  protect, 
  authorize, 
  adminOnly, 
  managerOrAdmin,
  projectMemberOrAdmin 
} = require('../middleware/auth');
const { ROLES } = require('../config/config');

// All project routes require authentication
router.use(protect);

// Get all projects (filtered by user role/access)
router.get('/', getProjects);

// Get project statistics
router.get('/:id/stats', projectMemberOrAdmin, getProjectStats);

// Get single project details
router.get('/:id', projectMemberOrAdmin, getProject);

// Create new project (admin and project managers only)
router.post('/', managerOrAdmin, createProject);

// Update project (project manager or admin)
router.put('/:id', projectMemberOrAdmin, updateProject);

// Delete project (admin only)
router.delete('/:id', adminOnly, deleteProject);

// Add a team member to a project (project manager or admin)
router.post('/:id/team', managerOrAdmin, addTeamMember);

// Remove a team member from a project (project manager or admin)
router.delete('/:projectId/team/:userId', managerOrAdmin, removeTeamMember);

module.exports = router;