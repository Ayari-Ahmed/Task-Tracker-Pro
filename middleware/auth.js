const { verifyToken, getTokenFromRequest } = require('../utils/jwtUtils');
const User = require('../models/User');
const { ROLES } = require('../config/config');

/**
 * Protect routes - Middleware to verify JWT token and ensure user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.protect = async (req, res, next) => {
  try {
    // Get token from request
    const token = getTokenFromRequest(req);

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user from the token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user data to request object
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      error: error.message
    });
  }
};

/**
 * Authorize based on user role - Middleware to restrict access based on user role
 * @param {...String} roles - Roles authorized to access the route
 * @returns {Function} - Express middleware function
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'User role not defined'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

/**
 * Admin only middleware - Shorthand for routes only accessible by administrators
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to administrators only'
    });
  }
  next();
};

/**
 * Project manager or admin middleware - For routes accessible by both roles
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.managerOrAdmin = (req, res, next) => {
  if (!req.user || 
      (req.user.role !== ROLES.ADMIN && 
       req.user.role !== ROLES.PROJECT_MANAGER)) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to project managers and administrators only'
    });
  }
  next();
};

/**
 * Middleware to check if user is part of a project or is admin
 * Used for project-specific routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.projectMemberOrAdmin = async (req, res, next) => {
  try {
    // If user is admin, allow access
    if (req.user && req.user.role === ROLES.ADMIN) {
      return next();
    }

    const projectId = req.params.projectId || req.body.project;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Import Project model here to avoid circular dependencies
    const Project = require('../models/Project');
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is project manager
    if (project.manager.toString() === req.user.id) {
      return next();
    }

    // Check if user is in project team
    if (project.team.includes(req.user.id)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Access restricted to project members only'
    });
  } catch (error) {
    console.error('Project member check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking project membership',
      error: error.message
    });
  }
};