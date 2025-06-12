// routes/viewRoutes.js
const express = require('express');
const router = express.Router();
const { getTokenFromRequest, verifyToken, generateToken } = require('../utils/jwtUtils');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { ROLES, TASK_STATUS } = require('../config/config');

/**
 * Authentication middleware for web routes
 */
const isAuthenticated = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/login');
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      res.clearCookie('token');
      return res.redirect('/login');
    }
    
    // Get user details
    const user = await User.findById(decoded.id);
    
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login');
    }
    
    // Add user to request and locals
    req.user = user;
    res.locals.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.clearCookie('token');
    res.redirect('/login');
  }
};

/**
 * Check if user is already logged in
 */
const checkNotAuthenticated = (req, res, next) => {
  const token = req.cookies.token;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      return res.redirect('/dashboard');
    }
  }
  
  next();
};

// Home page - redirects based on authentication
router.get('/', (req, res) => {
  const token = req.cookies.token;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      return res.redirect('/dashboard');
    }
  }
  
  res.render('home', { 
    title: 'Task Tracker Pro - Manage Your Projects Efficiently',
    layout: 'layouts/landing' // Use landing layout for homepage
  });
});

// Auth routes
router.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('auth/login', { 
    title: 'Login - Task Tracker Pro',
    layout: 'layouts/auth'
  });
});

router.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register - Task Tracker Pro',
    layout: 'layouts/auth'
  });
});

// Handle registration form submission
router.post('/register', checkNotAuthenticated, async (req, res) => {
  console.log('Attempting to register new user...');
  try {
    const { name, email, password, confirm_password, role } = req.body;
    
    console.log('Received registration data:', { name, email, role });

    // Validation
    if (!name || !email || !password || !confirm_password || !role) {
      console.log('Validation error: Missing fields');
      return res.render('auth/register', {
        title: 'Register - Task Tracker Pro',
        layout: 'layouts/auth',
        name,
        email,
        error: 'Please fill in all fields'
      });
    }
    
    if (password !== confirm_password) {
      console.log('Validation error: Passwords do not match');
      return res.render('auth/register', {
        title: 'Register - Task Tracker Pro',
        layout: 'layouts/auth',
        name,
        email,
        error: 'Passwords do not match'
      });
    }

    // Validate role: only 'team_member' and 'project_manager' allowed for public registration
    if (![ROLES.TEAM_MEMBER, ROLES.PROJECT_MANAGER].includes(role)) {
        console.log('Validation error: Invalid account type selected');
        return res.render('auth/register', {
            title: 'Register - Task Tracker Pro',
            layout: 'layouts/auth',
            name,
            email,
            error: 'Invalid account type selected.'
        });
    }
    
    // Check if user already exists
    console.log('Checking if user exists...');
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('Validation error: User with this email already exists');
      return res.render('auth/register', {
        title: 'Register - Task Tracker Pro',
        layout: 'layouts/auth',
        name,
        email,
        error: 'User with this email already exists'
      });
    }
    
    // Create user with selected role
    console.log('Creating user...');
    const user = await User.create({
      name,
      email,
      password,
      role // Use the selected role
    });
    
    console.log('User created successfully:', user.email);

    // Generate token
    console.log('Generating token...');
    const token = generateToken(user);
    
    // Set cookie
    console.log('Setting cookie and redirecting...');
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Redirect to dashboard with success message
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Registration error (caught):', error);
    res.render('auth/register', {
      title: 'Register - Task Tracker Pro',
      layout: 'layouts/auth',
      name: req.body.name,
      email: req.body.email,
      error: 'Server error during registration. Please try again.'
    });
  }
});

// Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    let projects = [];
    let tasks = [];
    let completedTasks = [];
    let pendingTasks = [];
    
    // Get projects based on user role
    if (user.role === ROLES.ADMIN) {
      projects = await Project.find()
        .populate('manager', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      projects = await Project.find({ manager: user._id })
        .populate('manager', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    } else {
      projects = await Project.find({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      })
      .populate('manager', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    }

    // Get tasks based on user role
    const taskFilter = {};
    if (user.role === ROLES.ADMIN) {
      // No filter for admin
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      const managedProjects = await Project.find({ manager: user._id }).select('_id');
      taskFilter.project = { $in: managedProjects.map(p => p._id) };
    } else {
      const userProjects = await Project.find({ 
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).select('_id');
      
      taskFilter.$or = [
        { assignedTo: user._id },
        { project: { $in: userProjects.map(p => p._id) } }
      ];
    }

    // Get all tasks for the user
    tasks = await Task.find(taskFilter)
      .populate('project', 'name')
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    // Get completed and pending tasks
    completedTasks = await Task.find({
      ...taskFilter,
      status: TASK_STATUS.COMPLETED
    }).lean();

    pendingTasks = await Task.find({
      ...taskFilter,
      status: { $ne: TASK_STATUS.COMPLETED }
    }).lean();

    res.render('dashboard/index', {
      title: 'Dashboard - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/dashboard',
      user: req.user,
      projects,
      tasks,
      completedTasks,
      pendingTasks,
      taskStatus: TASK_STATUS
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard data');
    res.render('dashboard/index', {
      title: 'Dashboard - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/dashboard',
      user: req.user,
      error: error.message,
      projects: [],
      tasks: [],
      completedTasks: [],
      pendingTasks: [],
      taskStatus: TASK_STATUS
    });
  }
});

// Projects routes
router.get('/projects', isAuthenticated, async (req, res) => {
  try {
    let projects;
    const user = req.user;
    const { search, status, sort } = req.query;
    
    // Build filter based on query parameters
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      filter.status = status;
    }
    
    // Build sort object
    const sortOptions = {
      createdAt: { createdAt: -1 },
      dueDate: { dueDate: 1 },
      name: { name: 1 },
      status: { status: 1 }
    };
    const sortBy = sortOptions[sort] || sortOptions.createdAt;
    
    // Different queries based on user role
    if (user.role === ROLES.ADMIN) {
      projects = await Project.find(filter)
        .populate('manager', 'name')
        .populate('team', 'name')
        .sort(sortBy)
        .lean();
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      projects = await Project.find({
        ...filter,
        manager: user._id
      })
        .populate('manager', 'name')
        .populate('team', 'name')
        .sort(sortBy)
        .lean();
    } else {
      projects = await Project.find({
        ...filter,
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      })
        .populate('manager', 'name')
        .populate('team', 'name')
        .sort(sortBy)
        .lean();
    }

    // Get managers for the create project modal (if user is admin)
    let managers = [];
    if (user.role === ROLES.ADMIN) {
      managers = await User.find({
        role: { $in: [ROLES.ADMIN, ROLES.PROJECT_MANAGER] }
      })
        .select('name')
        .sort('name')
        .lean();
    }

    res.render('projects/index', {
      title: 'Projects - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/projects',
      user: req.user,
      projects,
      managers,
      filters: {
        search: search || '',
        status: status || '',
        sort: sort || 'createdAt'
      }
    });
  } catch (error) {
    console.error('Projects page error:', error);
    req.flash('error', 'Error loading projects');
    res.render('projects/index', {
      title: 'Projects - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/projects',
      user: req.user,
      projects: [],
      managers: [],
      filters: {
        search: '',
        status: '',
        sort: 'createdAt'
      },
      error: error.message
    });
  }
});

router.get('/projects/new', isAuthenticated, async (req, res) => {
  // Only admin and project managers can create projects
  if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(req.user.role)) {
    req.flash('error', 'You do not have permission to create projects');
    return res.redirect('/projects');
  }
  
  try {
    // Get managers for dropdown
    const managers = await User.find({
      role: { $in: [ROLES.ADMIN, ROLES.PROJECT_MANAGER] }
    }).sort('name');
    
    // Get team members for dropdown
    const teamMembers = await User.find().sort('name');
    
    res.render('projects/new', {
      title: 'Create Project - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/projects/new',
      user: req.user,
      managers,
      teamMembers
    });
  } catch (error) {
    console.error('New project page error:', error);
    req.flash('error', 'Error loading form data');
    res.redirect('/projects');
  }
});

router.get('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('manager', 'name email role')
      .populate('team', 'name email role');
      
    if (!project) {
      req.flash('error', 'Project not found');
      return res.redirect('/projects');
    }
    
    // Check if user has access to this project
    const user = req.user;
    if (user.role !== ROLES.ADMIN) {
      const isManager = project.manager._id.toString() === user._id.toString();
      const isTeamMember = project.team.some(m => m._id.toString() === user._id.toString());
      
      if (!isManager && !isTeamMember) {
        req.flash('error', 'You do not have access to this project');
        return res.redirect('/projects');
      }
    }
    
    // Get project tasks
    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
      
    res.render('projects/detail', {
      title: `${project.name} - Task Tracker Pro`,
      layout: 'layouts/dashboard',
      path: '/projects',
      user: req.user,
      project,
      tasks,
      taskStatus: TASK_STATUS
    });
  } catch (error) {
    console.error('Project detail page error:', error);
    req.flash('error', 'Error loading project details');
    res.redirect('/projects');
  }
});

router.get('/projects/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      req.flash('error', 'Project not found');
      return res.redirect('/projects');
    }
    
    // Only admin and project manager can edit
    const user = req.user;
    const isAdmin = user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === user._id.toString();
    
    if (!isAdmin && !isManager) {
      req.flash('error', 'You do not have permission to edit this project');
      return res.redirect(`/projects/${project._id}`);
    }
    
    // Get managers and team members
    const managers = await User.find({
      role: { $in: [ROLES.ADMIN, ROLES.PROJECT_MANAGER] }
    }).sort('name');
    
    const teamMembers = await User.find().sort('name');
    
    res.render('projects/edit', {
      title: `Edit ${project.name} - Task Tracker Pro`,
      layout: 'layouts/dashboard',
      path: '/projects',
      user: req.user,
      project,
      managers,
      teamMembers
    });
  } catch (error) {
    console.error('Project edit page error:', error);
    req.flash('error', 'Error loading project edit form');
    res.redirect('/projects');
  }
});

// Delete project
router.delete('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Only admin and project manager can delete
    const user = req.user;
    const isAdmin = user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === user._id.toString();
    
    if (!isAdmin && !isManager) {
      return res.status(403).json({ success: false, error: 'You do not have permission to delete this project' });
    }
    
    // Delete associated tasks first
    await Task.deleteMany({ project: project._id });
    
    // Delete the project
    await project.deleteOne();
    
    // If it's an AJAX request, return JSON response
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Project deleted successfully' });
    }
    
    // For regular form submission, redirect
    req.flash('success', 'Project deleted successfully');
    res.redirect('/projects');
  } catch (error) {
    console.error('Delete project error:', error);
    
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Error deleting project' });
    }
    
    req.flash('error', 'Error deleting project');
    res.redirect('/projects');
  }
});

// Create new project (form submission)
router.post('/projects', isAuthenticated, async (req, res) => {
  console.log('Project creation request received:', {
    body: req.body,
    user: {
      id: req.user._id,
      role: req.user.role
    }
  });

  // Only admin and project managers can create projects
  if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(req.user.role)) {
    console.log('User not authorized to create projects:', req.user.role);
    req.flash('error', 'You do not have permission to create projects');
    return res.redirect('/projects');
  }

  try {
    // Add the current user as the manager if not specified
    if (!req.body.manager) {
      req.body.manager = req.user._id;
    }

    // Add start date if not provided
    if (!req.body.startDate) {
      req.body.startDate = new Date();
    }

    // Convert dates to proper format
    if (req.body.startDate) {
      req.body.startDate = new Date(req.body.startDate);
    }
    if (req.body.dueDate) {
      req.body.dueDate = new Date(req.body.dueDate);
    }

    console.log('Creating project with data:', req.body);

    // Create the project
    const project = await Project.create(req.body);
    console.log('Project created successfully:', project);

    req.flash('success', 'Project created successfully');
    res.redirect('/projects');
  } catch (error) {
    console.error('Create project error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      console.log('Validation errors:', messages);
      req.flash('error', messages.join(', '));
    } else {
      req.flash('error', 'Error creating project: ' + error.message);
    }
    
    // Redirect back to the form with the input data
    res.redirect('back');
  }
});

// Tasks routes
router.get('/tasks', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    const { search, status, priority, project: projectId } = req.query;
    
    // Build filter based on query parameters
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (projectId) filter.project = projectId;
    
    let tasks;
    
    // Different queries based on user role
    if (user.role === ROLES.ADMIN) {
      // No additional filter for admin
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      // Find projects managed by this user
      const managedProjects = await Project.find({ manager: user._id }).select('_id');
      const managedProjectIds = managedProjects.map(p => p._id);
      
      // Filter tasks to only include those from managed projects
      filter.project = filter.project ? filter.project : { $in: managedProjectIds };
    } else {
      // Find projects where user is a team member
      const userProjects = await Project.find({ 
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).select('_id');
      
      if (filter.project) {
        // If project filter is already specified, ensure user has access to it
        const projectIds = userProjects.map(p => p._id.toString());
        if (!projectIds.includes(filter.project.toString())) {
          req.flash('error', 'You do not have access to the specified project');
          return res.redirect('/tasks');
        }
      } else {
        // Otherwise filter based on user's projects
        filter.$or = [
          { assignedTo: user._id },
          { project: { $in: userProjects.map(p => p._id) } }
        ];
      }
    }
    
    tasks = await Task.find(filter)
      .populate('project', 'name manager')
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 })
      .lean();
      
    // Get projects for filter dropdown
    let projects;
    if (user.role === ROLES.ADMIN) {
      projects = await Project.find().sort('name').lean();
    } else {
      projects = await Project.find({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).sort('name').lean();
    }
      
    res.render('tasks/index', {
      title: 'Tasks - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/tasks',
      user: req.user,
      tasks,
      projects,
      taskStatus: TASK_STATUS,
      filters: {
        search: search || '',
        status: status || '',
        priority: priority || '',
        project: projectId || ''
      }
    });
  } catch (error) {
    console.error('Tasks page error:', error);
    req.flash('error', 'Error loading tasks');
    res.render('tasks/index', {
      title: 'Tasks - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/tasks',
      user: req.user,
      tasks: [],
      projects: [],
      taskStatus: TASK_STATUS,
      filters: {
        search: '',
        status: '',
        priority: '',
        project: ''
      },
      error: error.message
    });
  }
});

router.get('/tasks/new', isAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.query;
    const user = req.user;
    
    // Get projects based on user role
    let projects;
    if (user.role === ROLES.ADMIN) {
      projects = await Project.find().sort('name');
    } else {
      projects = await Project.find({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).sort('name');
    }

    // Get assignable users (team members and project managers)
    const assignableUsers = await User.find({
      role: { $in: [ROLES.TEAM_MEMBER, ROLES.PROJECT_MANAGER, ROLES.ADMIN] } // Include admins as they can assign tasks to themselves or others
    }).select('name').sort('name');
    
    res.render('tasks/new', {
      title: 'Create Task - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/tasks/new',
      user: req.user,
      projects,
      selectedProjectId: projectId || '',
      assignableUsers // Pass assignable users to the view
    });
  } catch (error) {
    console.error('New task page error:', error);
    req.flash('error', 'Error loading task creation form');
    res.redirect('/tasks');
  }
});

router.get('/tasks/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('comments.user', 'name');
      
    if (!task) {
      req.flash('error', 'Task not found');
      return res.redirect('/tasks');
    }
    
    // Check if user has access to this task
    const user = req.user;
    if (user.role !== ROLES.ADMIN) {
      const project = await Project.findById(task.project);
      
      if (!project) {
        req.flash('error', 'Associated project not found');
        return res.redirect('/tasks');
      }
      
      const isManager = project.manager.toString() === user._id.toString();
      const isTeamMember = project.team.some(m => m.toString() === user._id.toString());
      const isAssignee = task.assignedTo && task.assignedTo._id.toString() === user._id.toString();
      
      if (!isManager && !isTeamMember && !isAssignee) {
        req.flash('error', 'You do not have access to this task');
        return res.redirect('/tasks');
      }
    }
    
    res.render('tasks/detail', {
      title: `${task.title} - Task Tracker Pro`,
      layout: 'layouts/dashboard',
      path: `/tasks/${req.params.id}`,
      user: req.user,
      task,
      taskStatus: TASK_STATUS,
      fromPage: req.headers.referer || ''
    });
  } catch (error) {
    console.error('Task detail page error:', error);
    req.flash('error', 'Error loading task details');
    res.redirect('/tasks');
  }
});

router.get('/tasks/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      req.flash('error', 'Task not found');
      return res.redirect('/tasks');
    }
    
    const project = await Project.findById(task.project);
    
    if (!project) {
      req.flash('error', 'Associated project not found');
      return res.redirect('/tasks');
    }
    
    // Check if user can edit this task
    const user = req.user;
    const isAdmin = user.role === ROLES.ADMIN;
    const isManager = project.manager.toString() === user._id.toString();
    const isAssignee = task.assignedTo && task.assignedTo.toString() === user._id.toString();
    
    if (!isAdmin && !isManager && !isAssignee) {
      req.flash('error', 'You do not have permission to edit this task');
      return res.redirect(`/tasks/${task._id}`);
    }
    
    // Get team members for assignment dropdown
    const teamMembers = [
      ...await User.find({ _id: project.manager }),
      ...await User.find({ _id: { $in: project.team } })
    ];
    
    res.render('tasks/edit', {
      title: `Edit ${task.title} - Task Tracker Pro`,
      task,
      project,
      teamMembers,
      taskStatus: TASK_STATUS
    });
  } catch (error) {
    console.error('Task edit page error:', error);
    req.flash('error', 'Error loading task edit form');
    res.redirect('/tasks');
  }
});

// Create new task (form submission)
router.post('/tasks', isAuthenticated, async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      req.flash('error', 'Project is required');
      return res.redirect('/tasks/new');
    }
    
    // Check if project exists
    const projectDoc = await Project.findById(project);
    
    if (!projectDoc) {
      req.flash('error', 'Project not found');
      return res.redirect('/tasks/new');
    }
    
    // Check if user has access to create tasks in this project
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isManager = projectDoc.manager.toString() === req.user._id.toString();
    const isTeamMember = projectDoc.team.some(member => 
      member.toString() === req.user._id.toString()
    );
    
    if (!isAdmin && !isManager && !isTeamMember) {
      req.flash('error', 'You do not have permission to create tasks in this project');
      return res.redirect('/tasks/new');
    }
    
    // Add creator information
    req.body.createdBy = req.user._id;
    
    // Create the task
    const task = await Task.create(req.body);
    
    req.flash('success', 'Task created successfully');
    res.redirect('/tasks');
  } catch (error) {
    console.error('Create task error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      req.flash('error', messages.join(', '));
    } else {
      req.flash('error', 'Error creating task: ' + error.message);
    }
    
    // Redirect back to the form with the input data
    res.redirect('back');
  }
});

// Profile route
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    
    // Get user stats
    const stats = {
      projects: 0,
      tasks: 0
    };
    
    // Get project count based on user role
    if (user.role === ROLES.ADMIN) {
      stats.projects = await Project.countDocuments();
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      stats.projects = await Project.countDocuments({ manager: user._id });
    } else {
      stats.projects = await Project.countDocuments({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      });
    }
    
    // Get task count based on user role
    const taskFilter = {};
    if (user.role === ROLES.ADMIN) {
      // No filter for admin
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      const managedProjects = await Project.find({ manager: user._id }).select('_id');
      taskFilter.project = { $in: managedProjects.map(p => p._id) };
    } else {
      const userProjects = await Project.find({ 
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).select('_id');
      
      taskFilter.$or = [
        { assignedTo: user._id },
        { project: { $in: userProjects.map(p => p._id) } }
      ];
    }
    
    stats.tasks = await Task.countDocuments(taskFilter);
    
    res.render('auth/profile', {
      title: 'Profile - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/profile',
      user: req.user,
      stats
    });
  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Error loading profile data');
    res.render('auth/profile', {
      title: 'Profile - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/profile',
      user: req.user,
      stats: { projects: 0, tasks: 0 },
      error: error.message
    });
  }
});

// Error page
router.get('/error', (req, res) => {
  res.render('error', {
    title: 'Error - Task Tracker Pro',
    message: req.query.message || 'An error occurred',
    statusCode: req.query.statusCode || 500
  });
});

// Calendar route
router.get('/calendar', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    let tasks = [];
    let projects = [];

    // Fetch tasks based on user role
    const taskFilter = {};
    if (user.role === ROLES.ADMIN) {
      tasks = await Task.find()
        .populate('project', 'name')
        .populate('assignedTo', 'name')
        .lean();
      projects = await Project.find().lean();
    } else if (user.role === ROLES.PROJECT_MANAGER) {
      // Project managers see tasks and projects they manage or are assigned to
      const managedProjects = await Project.find({ manager: user._id }).select('_id');
      const managedProjectIds = managedProjects.map(p => p._id);

      tasks = await Task.find({
        $or: [
          { assignedTo: user._id },
          { project: { $in: managedProjectIds } }
        ]
      })
        .populate('project', 'name')
        .populate('assignedTo', 'name')
        .lean();

      projects = await Project.find({
        $or: [
          { manager: user._id },
          { _id: { $in: managedProjectIds } } // Include managed projects
        ]
      }).lean();

    } else { // Team Member
      // Team members see tasks assigned to them and projects they are part of
      const userProjects = await Project.find({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).select('_id');
      const userProjectIds = userProjects.map(p => p._id);

      tasks = await Task.find({
        $or: [
          { assignedTo: user._id },
          { project: { $in: userProjectIds } }
        ]
      })
        .populate('project', 'name')
        .populate('assignedTo', 'name')
        .lean();

      projects = await Project.find({
        $or: [
          { manager: user._id },
          { team: { $in: [user._id] } }
        ]
      }).lean();
    }

    // Format tasks and projects into FullCalendar events
    const events = [];

    // Add tasks as events
    tasks.forEach(task => {
      if (task.dueDate) {
        events.push({
          id: task._id,
          title: `Task: ${task.title}`,
          start: task.dueDate.toISOString().split('T')[0],
          end: task.dueDate.toISOString().split('T')[0],
          allDay: true,
          backgroundColor: '#0d6efd',
          borderColor: '#0d6efd',
          url: `/tasks/${task._id}`,
          extendedProps: {
            type: 'task',
            status: task.status,
            priority: task.priority,
            assignedTo: task.assignedTo ? task.assignedTo.name : 'Unassigned',
            project: task.project ? { id: task.project._id, name: task.project.name } : null
          }
        });
      }
    });

    // Add project due dates as events
    projects.forEach(project => {
      if (project.dueDate) {
        events.push({
          id: project._id,
          title: `Project Due: ${project.name}`,
          start: project.dueDate.toISOString().split('T')[0],
          end: project.dueDate.toISOString().split('T')[0],
          allDay: true,
          backgroundColor: '#6f42c1',
          borderColor: '#6f42c1',
          url: `/projects/${project._id}`,
          extendedProps: {
            type: 'project_due',
            status: project.status,
            manager: project.manager ? project.manager.name : 'N/A'
          }
        });
      }
    });

    res.render('calendar/index', {
      title: 'Calendar - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/calendar',
      user: req.user,
      events: JSON.stringify(events), // Pass events as a JSON string
      projects, // Pass projects to the template
      taskStatus: TASK_STATUS // Pass taskStatus (imported from config/config) to the template
    });

  } catch (error) {
    console.error('Calendar page error:', error);
    req.flash('error', 'Error loading calendar data');
    res.render('calendar/index', {
      title: 'Calendar - Task Tracker Pro',
      layout: 'layouts/dashboard',
      path: '/calendar',
      user: req.user,
      events: '[]',
      projects: [], // Pass an empty array in case of error
      taskStatus: TASK_STATUS, // Pass taskStatus (imported from config/config) to the template
      error: error.message
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
    // Clear the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/dashboard');
        }
        // Clear the cookie
        res.clearCookie('token');
        // Redirect to login page
        res.redirect('/login');
    });
});

// Admin routes
router.get('/admin', isAuthenticated, async (req, res) => {
  // Only admin users can access the admin panel
  if (req.user.role !== ROLES.ADMIN) {
    req.flash('error', 'You do not have permission to access the admin panel');
    return res.redirect('/dashboard');
  }

  res.render('admin/index', {
    title: 'Admin Panel - Task Tracker Pro',
    layout: 'layouts/dashboard',
    path: '/admin',
    user: req.user,
  });
});

module.exports = router;