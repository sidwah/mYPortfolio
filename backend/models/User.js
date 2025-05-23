const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Authentication
  username: { 
    type: String, 
    required: [true, 'Username is required'], 
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  avatar: String,
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'admin'
  },
  
  // Security
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0, max: 5 },
  accountLocked: { type: Boolean, default: false },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Settings
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    notifications: { type: Boolean, default: true },
    language: { type: String, default: 'en' }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only run if password was modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.accountLocked && this.lockUntil && this.lockUntil > Date.now());
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = {
      accountLocked: true,
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Static method to find user for login
userSchema.statics.getAuthenticated = async function(username, password) {
  const user = await this.findOne({
    $or: [{ email: username }, { username: username }]
  }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if account is locked
  if (user.isLocked()) {
    await user.incLoginAttempts();
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }
  
  // Test password
  const isMatch = await user.comparePassword(password);
  
  if (isMatch) {
    // If there was no lock but we had failed attempts, reset attempts
    if (user.loginAttempts && !user.accountLocked) {
      const updates = {
        $unset: { loginAttempts: 1 },
        $set: { lastLogin: Date.now() }
      };
      await user.updateOne(updates);
    }
    return user;
  }
  
  // Password incorrect, increment login attempts
  await user.incLoginAttempts();
  throw new Error('Invalid credentials');
};

module.exports = mongoose.model('User', userSchema);