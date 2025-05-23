const mongoose = require('mongoose');
const crypto = require('crypto');

const subscriberSchema = new mongoose.Schema({
  // Basic Information
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
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  // Subscription Status
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Subscription Preferences
  preferences: {
    projectUpdates: { type: Boolean, default: true },
    blogPosts: { type: Boolean, default: true },
    newsletters: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['immediate', 'weekly', 'monthly'],
      default: 'weekly'
    }
  },
  
  // Source Tracking
  source: {
    type: String,
    enum: ['homepage', 'project-page', 'about-page', 'contact-form', 'blog', 'social-media', 'other'],
    default: 'homepage'
  },
  referrer: String, // What page they came from
  userAgent: String, // Browser info
  ipAddress: String,
  
  // Engagement Tracking
  stats: {
    emailsReceived: { type: Number, default: 0 },
    emailsOpened: { type: Number, default: 0 },
    linksClicked: { type: Number, default: 0 },
    lastEmailSent: Date,
    lastEmailOpened: Date,
    lastEngagement: Date
  },
  
  // Unsubscribe
  unsubscribeToken: {
    type: String,
    default: function() {
      return crypto.randomBytes(32).toString('hex');
    }
  },
  unsubscribedAt: Date,
  unsubscribeReason: {
    type: String,
    enum: ['too-frequent', 'not-relevant', 'never-signed-up', 'technical-issues', 'other']
  },
  
  // Tags for segmentation
  tags: [String],
  
  // Timestamps
  subscribedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
subscriberSchema.index({ email: 1 });
subscriberSchema.index({ isActive: 1 });
subscriberSchema.index({ emailVerified: 1 });
subscriberSchema.index({ tags: 1 });
subscriberSchema.index({ 'preferences.frequency': 1 });

// Pre-save middleware
subscriberSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate verification token if email not verified
  if (!this.emailVerified && !this.emailVerificationToken) {
    this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  }
  
  next();
});

// Instance Methods
subscriberSchema.methods.generateVerificationToken = function() {
  this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return this.emailVerificationToken;
};

subscriberSchema.methods.verifyEmail = function() {
  this.emailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.unsubscribe = function(reason) {
  this.isActive = false;
  this.unsubscribedAt = Date.now();
  this.unsubscribeReason = reason || 'other';
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.resubscribe = function() {
  this.isActive = true;
  this.unsubscribedAt = undefined;
  this.unsubscribeReason = undefined;
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.updatePreferences = function(newPreferences) {
  this.preferences = { ...this.preferences, ...newPreferences };
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.trackEmailSent = function() {
  this.stats.emailsReceived += 1;
  this.stats.lastEmailSent = Date.now();
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.trackEmailOpened = function() {
  this.stats.emailsOpened += 1;
  this.stats.lastEmailOpened = Date.now();
  this.stats.lastEngagement = Date.now();
  this.updatedAt = Date.now();
  return this.save();
};

subscriberSchema.methods.trackLinkClicked = function() {
  this.stats.linksClicked += 1;
  this.stats.lastEngagement = Date.now();
  this.updatedAt = Date.now();
  return this.save();
};

// Static Methods
subscriberSchema.statics.getActiveSubscribers = function(frequency = null) {
  const query = { isActive: true, emailVerified: true };
  if (frequency) {
    query['preferences.frequency'] = frequency;
  }
  return this.find(query);
};

subscriberSchema.statics.getSubscriberStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        verified: { $sum: { $cond: ['$emailVerified', 1, 0] } },
        unsubscribed: { $sum: { $cond: ['$isActive', 0, 1] } }
      }
    }
  ]);
};

subscriberSchema.statics.getSubscribersBySource = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('Subscriber', subscriberSchema);