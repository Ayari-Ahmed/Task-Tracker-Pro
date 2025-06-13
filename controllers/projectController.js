const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES } = require('../config/config');

/**
 * @desc    Get all projects (with different access levels based on role)
 * @route   GET /api/projects
 * @access  Private
 */
exports.getProjects = async (req, res) => {
  try {
    let projects;
    const { role, id } = req.user;

    // Admin can see all projects
    if (role === ROLES.ADMIN) {
      projects = await Project.find().populate('manager', 'name email').populate('team', 'name email');
    }
    // Project managers see their managed projects
    else if (role === ROLES.PROJECT_MANAGER) {
      projects = await Project.find({ manager: id }).populate('manager', 'name email').populate('team', 'name email');
    }
    // Team members see projects they're part of
    else {
      projects = await Project.find({ $or: [{ manager: id }, { team: { $in: [id] } }] }).populate('manager', 'name email').populate('team', 'name email');
    }

    // Calculate progress for each project
    const projectsWithProgress = await Promise.all(
      projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task) => task.status === 'completed').length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return {
          ...project.toObject(),
          progress: progress,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: projectsWithProgress.length,
      data: projectsWithProgress,
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching projects',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single project
 * @route   GET /api/projects/:id
 * @access  Private (project members, manager, or admin)
 */
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('manager', 'name email profilePicture')
      .populate('team', 'name email profilePicture')
      .populate({
        path: 'tasks',
        populate: {
          path: 'assignedTo',
          select: 'name profilePicture'
        }
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Calculate project progress
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(task => task.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    project.progress = progress;

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project',
      error: error.message
    });
  }
};

/**
 * @desc    Create new project
 * @route   POST /api/projects
 * @access  Private (admin and project managers only)
 */
exports.createProject = async (req, res) => {
  try {
    // Only admins and project managers can create projects
    if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create projects'
      });
    }

    // Add the current user as the manager if not specified
    if (!req.body.manager) {
      req.body.manager = req.user.id;
    }

    // Check if specified manager exists and is a manager or admin
    if (req.body.manager !== req.user.id) {
      const manager = await User.findById(req.body.manager);
      if (!manager) {
        return res.status(400).json({
          success: false,
          message: 'Invalid manager ID specified'
        });
      }

      if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(manager.role)) {
        return res.status(400).json({
          success: false,
          message: 'Project manager must have admin or manager role'
        });
      }
    }

    // Validate team members (if provided)
    if (req.body.team && req.body.team.length > 0) {
      const teamMembers = await User.find({
        _id: { $in: req.body.team }
      });

      if (teamMembers.length !== req.body.team.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more team member IDs are invalid'
        });
      }
    }

    // Create the project
    const project = await Project.create(req.body);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Create project error:', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating project',
      error: error.message
    });
  }
};

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Private (project manager or admin)
 */
exports.updateProject = async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is project manager or admin
    const isManager = project.manager.toString() === req.user.id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this project'
      });
    }

    // Only admin can change the project manager
    if (req.body.manager && req.body.manager !== project.manager.toString() && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change the project manager'
      });
    }

    // Validate new manager (if changing)
    if (req.body.manager && req.body.manager !== project.manager.toString()) {
      const newManager = await User.findById(req.body.manager);
      if (!newManager) {
        return res.status(400).json({
          success: false,
          message: 'Invalid manager ID specified'
        });
      }

      if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(newManager.role)) {
        return res.status(400).json({
          success: false,
          message: 'Project manager must have admin or manager role'
        });
      }
    }

    // Update the project
    project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating project',
      error: error.message
    });
  }
};

/**
 * @desc    Add a team member to a project
 * @route   POST /api/projects/:id/team
 * @access  Private (project manager or admin)
 */
exports.addTeamMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is project manager or admin
    const isManager = project.manager.toString() === req.user.id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add team members to this project'
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if member is already in the team
    if (project.team.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this project'
      });
    }

    // Add user to the team
    project.team.push(userId);
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Team member added successfully',
      data: project
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding team member',
      error: error.message
    });
  }
};

/**
 * @desc    Remove a team member from a project
 * @route   DELETE /api/projects/:projectId/team/:userId
 * @access  Private (project manager or admin)
 */
exports.removeTeamMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is project manager or admin
    const isManager = project.manager.toString() === req.user.id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove team members from this project'
      });
    }

    const { userId } = req.params;

    // Check if member is in the team
    if (!project.team.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this project'
      });
    }

    // Remove user from the team
    project.team = project.team.filter(memberId => memberId.toString() !== userId);
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Team member removed successfully',
      data: project
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing team member',
      error: error.message
    });
  }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/projects/:id
 * @access  Private (admin only)
 */
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Only admin can delete projects
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete projects'
      });
    }

    await project.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting project',
      error: error.message
    });
  }
};

/**
 * @desc    Get project dashboard stats
 * @route   GET /api/projects/:id/stats
 * @access  Private (project members, manager, or admin)
 */
exports.getProjectStats = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate({
        path: 'tasks',
        select: 'status priority dueDate estimatedHours actualHours'
      });
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Calculate stats
    const tasks = project.tasks || [];
    const totalTasks = tasks.length;
    
    // Task status counts
    const statusCounts = {
      to_do: 0,
      in_progress: 0,
      review: 0,
      completed: 0
    };
    
    // Priority distribution
    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    };
    
    // Hours stats
    let totalEstimatedHours = 0;
    let totalActualHours = 0;
    
    // Process tasks
    tasks.forEach(task => {
      // Count by status
      if (statusCounts.hasOwnProperty(task.status)) {
        statusCounts[task.status]++;
      }
      
      // Count by priority
      if (priorityCounts.hasOwnProperty(task.priority)) {
        priorityCounts[task.priority]++;
      }
      
      // Hours calculation
      totalEstimatedHours += task.estimatedHours || 0;
      totalActualHours += task.actualHours || 0;
    });
    
    // Calculate completion percentage
    const completionPercentage = totalTasks > 0 
      ? Math.round((statusCounts.completed / totalTasks) * 100) 
      : 0;
    
    // Calculate if project is on schedule
    const isOnSchedule = totalEstimatedHours >= totalActualHours;
    
    // Calculate upcoming deadlines (tasks due in next 7 days)
    const currentDate = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(currentDate.getDate() + 7);
    
    const upcomingDeadlines = tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= currentDate && dueDate <= nextWeek;
    }).length;
    
    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        completionPercentage,
        statusCounts,
        priorityCounts,
        hoursStats: {
          estimated: totalEstimatedHours,
          actual: totalActualHours,
          difference: totalEstimatedHours - totalActualHours
        },
        isOnSchedule,
        upcomingDeadlines
      }
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project statistics',
      error: error.message
    });
  }
};
