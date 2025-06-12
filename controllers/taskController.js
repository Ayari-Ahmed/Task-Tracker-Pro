const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES, TASK_STATUS } = require('../config/config');
const mongoose = require('mongoose');

/**
 * @desc    Get all tasks (with different access levels based on role)
 * @route   GET /api/tasks
 * @access  Private
 */
exports.getTasks = async (req, res) => {
  try {
    let tasks;
    const { role, id } = req.user;
    const { project, status, priority, assignedTo } = req.query;
    
    // Base filter
    const filter = {};
    
    // Apply filters if provided
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    // Admin can see all tasks
    if (role === ROLES.ADMIN) {
      // No additional filter needed, admins see all tasks with applied filters
    } 
    // Project managers see tasks for their projects
    else if (role === ROLES.PROJECT_MANAGER) {
      // Find projects managed by this user
      const managedProjects = await Project.find({ manager: id }).select('_id');
      const managedProjectIds = managedProjects.map(p => p._id);
      
      // Filter tasks to only include those from managed projects
      filter.project = { $in: managedProjectIds };
    } 
    // Team members see tasks they're assigned to or in projects they're part of
    else {
      // Find projects where user is a team member
      const userProjects = await Project.find({ 
        $or: [
          { manager: id },
          { team: { $in: [id] } }
        ]
      }).select('_id');
      const userProjectIds = userProjects.map(p => p._id);
      
      filter.$or = [
        { assignedTo: id }, // Tasks assigned to the user
        { project: { $in: userProjectIds } } // Tasks in projects user is part of
      ];
    }
    
    // Query tasks with filters and populate references
    tasks = await Task.find(filter)
      .populate('project', 'name')
      .populate('assignedTo', 'name email profilePicture')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
      
    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tasks',
      error: error.message
    });
  }
};

/**
 * @desc    Get single task
 * @route   GET /api/tasks/:id
 * @access  Private (task members, project manager, or admin)
 */
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name')
      .populate('assignedTo', 'name email profilePicture')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name profilePicture');
      
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user has access to this task (admin, project manager, or team member)
    if (req.user.role !== ROLES.ADMIN) {
      const project = await Project.findById(task.project);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Associated project not found'
        });
      }
      
      const isManager = project.manager.toString() === req.user.id;
      const isTeamMember = project.team.some(member => 
        member.toString() === req.user.id
      );
      const isAssignee = task.assignedTo && task.assignedTo._id.toString() === req.user.id;
      
      if (!isManager && !isTeamMember && !isAssignee) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this task'
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching task',
      error: error.message
    });
  }
};

/**
 * @desc    Create new task
 * @route   POST /api/tasks
 * @access  Private (project members, manager, or admin)
 */
exports.createTask = async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    // Check if project exists
    const projectDoc = await Project.findById(project);
    
    if (!projectDoc) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user has access to create tasks in this project
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = projectDoc.manager.toString() === req.user.id;
    const isTeamMember = projectDoc.team.some(member => 
      member.toString() === req.user.id
    );
    
    if (!isAdmin && !isManager && !isTeamMember) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create tasks in this project'
      });
    }
    
    // If assignedTo is provided, validate the user
    if (req.body.assignedTo) {
      const assignee = await User.findById(req.body.assignedTo);
      
      if (!assignee) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assignee ID'
        });
      }
      
      // Check if assignee is part of the project team
      const isAssigneeManager = projectDoc.manager.toString() === req.body.assignedTo;
      const isAssigneeTeamMember = projectDoc.team.some(member => 
        member.toString() === req.body.assignedTo
      );
      
      if (!isAssigneeManager && !isAssigneeTeamMember) {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a member of the project team'
        });
      }
    }
    
    // Add creator information
    req.body.createdBy = req.user.id;
    
    // Create the task
    const task = await Task.create(req.body);
    
    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Create task error:', error);
    
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
      message: 'Server error while creating task',
      error: error.message
    });
  }
};

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:id
 * @access  Private (task assignee, project manager, or admin)
 */
exports.updateTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const project = await Project.findById(task.project);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found'
      });
    }
    
    // Check if user has permission to update this task
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === req.user.id;
    const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user.id;
    
    if (!isAdmin && !isManager && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }
    
    // If changing assignee, validate the new assignee
    if (req.body.assignedTo && req.body.assignedTo !== task.assignedTo?.toString()) {
      const assignee = await User.findById(req.body.assignedTo);
      
      if (!assignee) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assignee ID'
        });
      }
      
      // Check if assignee is part of the project team
      const isAssigneeManager = project.manager.toString() === req.body.assignedTo;
      const isAssigneeTeamMember = project.team.some(member => 
        member.toString() === req.body.assignedTo
      );
      
      if (!isAssigneeManager && !isAssigneeTeamMember) {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a member of the project team'
        });
      }
    }
    
    // If status is changing to completed, set completedAt
    if (req.body.status === TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.COMPLETED) {
      req.body.completedAt = Date.now();
    }
    
    // Update the task
    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating task',
      error: error.message
    });
  }
};

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:id
 * @access  Private (project manager or admin)
 */
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const project = await Project.findById(task.project);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found'
      });
    }
    
    // Only project managers and admins can delete tasks
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === req.user.id;
    
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task'
      });
    }
    
    await task.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting task',
      error: error.message
    });
  }
};

/**
 * @desc    Add comment to task
 * @route   POST /api/tasks/:id/comments
 * @access  Private (task members, project manager, or admin)
 */
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user has access to this task
    const project = await Project.findById(task.project);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found'
      });
    }
    
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === req.user.id;
    const isTeamMember = project.team.some(member => 
      member.toString() === req.user.id
    );
    const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user.id;
    
    if (!isAdmin && !isManager && !isTeamMember && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to comment on this task'
      });
    }
    
    // Add comment
    const comment = {
      user: req.user.id,
      text,
      createdAt: Date.now()
    };
    
    task.comments.push(comment);
    await task.save();
    
    // Reload task with populated comments
    const updatedTask = await Task.findById(req.params.id)
      .populate('comments.user', 'name profilePicture');
    
    res.status(201).json({
      success: true,
      data: updatedTask.comments[updatedTask.comments.length - 1],
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding comment',
      error: error.message
    });
  }
};

/**
 * @desc    Update task status
 * @route   PATCH /api/tasks/:id/status
 * @access  Private (task assignee, project manager, or admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !Object.values(TASK_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const project = await Project.findById(task.project);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found'
      });
    }
    
    // Check if user has permission to update this task
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === req.user.id;
    const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user.id;
    
    if (!isAdmin && !isManager && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task status'
      });
    }
    
    // Update status
    const updateData = { status };
    
    // If status is changing to completed, set completedAt
    if (status === TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.COMPLETED) {
      updateData.completedAt = Date.now();
    } else if (status !== TASK_STATUS.COMPLETED) {
      // If moving from completed to another status, clear completedAt
      updateData.completedAt = null;
    }
    
    task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: task,
      message: 'Task status updated successfully'
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating task status',
      error: error.message
    });
  }
};

/**
 * @desc    Get task statistics for dashboard
 * @route   GET /api/tasks/stats
 * @access  Private
 */
exports.getTaskStats = async (req, res) => {
  try {
    const { id, role } = req.user;
    let projectFilter = {};
    
    // Filter projects based on user role
    if (role !== ROLES.ADMIN) {
      // Find projects this user is associated with
      const userProjects = await Project.find({
        $or: [
          { manager: id },
          { team: { $in: [id] } }
        ]
      }).select('_id');
      
      const userProjectIds = userProjects.map(p => p._id);
      projectFilter = { project: { $in: userProjectIds } };
    }
    
    // Get counts by status
    const statusCounts = await Task.aggregate([
      { $match: projectFilter },
      { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Transform to object with status as keys
    const tasksByStatus = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    
    // Get counts by priority
    const priorityCounts = await Task.aggregate([
      { $match: projectFilter },
      { $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Transform to object with priority as keys
    const tasksByPriority = priorityCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    
    // Get overdue tasks
    const currentDate = new Date();
    const overdueTasks = await Task.countDocuments({
      ...projectFilter,
      status: { $ne: TASK_STATUS.COMPLETED },
      dueDate: { $lt: currentDate }
    });
    
    // Get tasks due today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const dueToday = await Task.countDocuments({
      ...projectFilter,
      status: { $ne: TASK_STATUS.COMPLETED },
      dueDate: { 
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    // If user is not admin, get tasks assigned to them
    let assignedToMe = 0;
    if (role !== ROLES.ADMIN) {
      assignedToMe = await Task.countDocuments({
        assignedTo: id
      });
    }
    
    // Get recently completed tasks (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentlyCompleted = await Task.countDocuments({
      ...projectFilter,
      status: TASK_STATUS.COMPLETED,
      completedAt: { $gte: lastWeek }
    });
    
    res.status(200).json({
      success: true,
      data: {
        tasksByStatus,
        tasksByPriority,
        overdueTasks,
        dueToday,
        assignedToMe,
        recentlyCompleted,
        totalTasks: Object.values(tasksByStatus).reduce((sum, count) => sum + count, 0)
      }
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching task statistics',
      error: error.message
    });
  }
};