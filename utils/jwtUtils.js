const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/config');

/**
 * Generate JWT token for authenticated users
 * @param {Object} user - User object with id
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role 
    }, 
    JWT_SECRET, 
    { 
      expiresIn: JWT_EXPIRE 
    }
  );
};

/**
 * Verify and decode JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {String|null} JWT token or null if not found
 */
const getTokenFromRequest = (req) => {
  // Check for token in headers
  let token;
  
  if (
    req.headers.authorization && 
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Get token from header
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  return token;
};

module.exports = {
  generateToken,
  verifyToken,
  getTokenFromRequest
};