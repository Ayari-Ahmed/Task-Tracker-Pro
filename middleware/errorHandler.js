// middleware/errorHandler.js
/**
 * Error handling middleware
 * @param {Object} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log error for server-side visibility
  console.error('Error:', err.message);
  console.error(err.stack);
  
  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Extract all validation error messages
    const messages = Object.values(err.errors).map(val => val.message);
    message = messages.join(', ');
  }
  
  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    message = `Duplicate field value entered: ${JSON.stringify(err.keyValue)}`;
  }
  
  // Handle Mongoose cast error (invalid ObjectID, etc.)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  
  // Format response based on request type
  if (req.xhr || req.headers.accept.includes('application/json') || req.path.startsWith('/api/')) {
    // JSON response for API requests
    return res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  // HTML response for web requests
  res.status(statusCode).render('error', {
    title: `Error ${statusCode}`,
    message,
    statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : ''
  });
};

module.exports = errorHandler;