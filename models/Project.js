const mongoose = require('mongoose');
const { ROLES } = require('../config/config');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project must have a manager']
  },
  team: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  startDate: {
    type: Date,
    required: [true, 'Project start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for project tasks
ProjectSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project',
  justOne: false
});

// Calculate project completion percentage
ProjectSchema.methods.getCompletionPercentage = async function() {
  // Ensure tasks are populated
  await this.populate('tasks');
  
  if (!this.tasks || this.tasks.length === 0) return 0;
  
  const completedTasks = this.tasks.filter(task => 
    task.status === 'completed'
  ).length;
  
  return Math.round((completedTasks / this.tasks.length) * 100);
};

// Add middleware to ensure only Project Managers and Admins can create projects
ProjectSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      // User model should be imported here to avoid circular dependencies
      const User = mongoose.model('User');
      const manager = await User.findById(this.manager);
      
      if (!manager) {
        throw new Error('Invalid manager ID provided');
      }
      
      if (manager.role !== ROLES.PROJECT_MANAGER && manager.role !== ROLES.ADMIN) {
        throw new Error('Only project managers and admins can be assigned as project managers');
      }
      
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Project', ProjectSchema);