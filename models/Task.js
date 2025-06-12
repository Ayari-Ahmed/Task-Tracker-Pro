const mongoose = require('mongoose');
const { TASK_STATUS, PRIORITY } = require('../config/config');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [100, 'Task title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Task must be associated with a project']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(TASK_STATUS),
    default: TASK_STATUS.TODO
  },
  priority: {
    type: String,
    enum: Object.values(PRIORITY),
    default: PRIORITY.MEDIUM
  },
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative']
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative']
  },
  comments: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      text: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  attachments: [
    {
      fileName: String,
      filePath: String,
      fileType: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

// Update the updatedAt timestamp before saving
TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If status is being changed to completed, set completedAt
  if (this.isModified('status') && this.status === TASK_STATUS.COMPLETED) {
    this.completedAt = Date.now();
  }
  
  next();
});

// Middleware to check if user exists and is part of the project
TaskSchema.pre('save', async function(next) {
  if (this.assignedTo) {
    try {
      // Import models here to avoid circular dependencies
      const User = mongoose.model('User');
      const Project = mongoose.model('Project');
      
      const [user, project] = await Promise.all([
        User.findById(this.assignedTo),
        Project.findById(this.project)
      ]);
      
      if (!user) {
        throw new Error('Invalid user assignment');
      }
      
      if (!project) {
        throw new Error('Invalid project association');
      }
      
      // Check if user is part of the project team
      if (!project.team.includes(this.assignedTo) && 
          project.manager.toString() !== this.assignedTo.toString()) {
        throw new Error('User must be part of the project team to be assigned tasks');
      }
      
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Task', TaskSchema);