// server.js
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Create Express app
const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parser
app.use(cookieParser());

// Method override to support PUT and DELETE in forms
app.use(methodOverride('_method'));

// Session setup
app.use(expressSession({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 60 * 60 * 1000 // 1 hour
  }
}));

// Connect flash for flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Front-end Routes
app.use('/', require('./routes/viewRoutes'));

// Error handling middleware
app.use(require('./middleware/errorHandler'));

// Fallback for unhandled routes
app.use((req, res) => {
  if (req.xhr || /^\/api\//.test(req.path)) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  // Create a dummy error object for 404 pages to avoid ReferenceError
  const error = new Error('Not Found');
  error.statusCode = 404;
  
  return res.status(404).render('error', {
    title: '404 - Page Not Found',
    message: 'The page you are looking for does not exist',
    statusCode: 404,
    stack: process.env.NODE_ENV === 'development' ? error.stack : '' // Pass stack for development
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  // server.close(() => process.exit(1));
});