module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Role enums for user authorization
  ROLES: {
    ADMIN: 'admin',
    PROJECT_MANAGER: 'project_manager',
    TEAM_MEMBER: 'team_member'
  },
  
  // Task status enums
  TASK_STATUS: {
    TODO: 'to_do',
    IN_PROGRESS: 'in_progress',
    REVIEW: 'review',
    COMPLETED: 'completed'
  },
  
  // Priority levels
  PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  }
};