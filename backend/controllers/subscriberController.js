const Subscriber = require('../models/Subscriber');

// @desc    Subscribe to newsletter
// @route   POST /api/subscribers
// @access  Public
const subscribe = async (req, res) => {
  try {
    const { email, firstName, lastName, preferences, source } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if already subscribed
    const existingSubscriber = await Subscriber.findOne({ email });
    
    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Email is already subscribed'
        });
      } else {
        // Reactivate subscription
        await existingSubscriber.resubscribe();
        return res.json({
          success: true,
          message: 'Welcome back! Your subscription has been reactivated.',
          data: {
            subscriber: {
              email: existingSubscriber.email,
              isActive: existingSubscriber.isActive,
              preferences: existingSubscriber.preferences
            }
          }
        });
      }
    }
    
    // Get client info for tracking
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const referrer = req.get('Referer');
    
    // Create new subscriber
    const subscriber = await Subscriber.create({
      email,
      firstName,
      lastName,
      preferences: preferences || {},
      source: source || 'homepage',
      userAgent,
      ipAddress,
      referrer
    });
    
    res.status(201).json({
      success: true,
      message: 'Successfully subscribed! Please check your email to verify your subscription.',
      data: {
        subscriber: {
          email: subscriber.email,
          isActive: subscriber.isActive,
          emailVerified: subscriber.emailVerified,
          preferences: subscriber.preferences
        }
      }
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email is already subscribed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Subscription failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify email subscription
// @route   GET /api/subscribers/verify/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    const subscriber = await Subscriber.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    await subscriber.verifyEmail();
    
    res.json({
      success: true,
      message: 'Email verified successfully! You are now subscribed to updates.'
    });
    
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

// @desc    Unsubscribe from newsletter
// @route   DELETE /api/subscribers/:email
// @access  Public
const unsubscribe = async (req, res) => {
  try {
    const { email } = req.params;
    const { reason, token } = req.query;
    
    let subscriber;
    
    // If token provided, find by token (from email link)
    if (token) {
      subscriber = await Subscriber.findOne({ unsubscribeToken: token });
    } else {
      // Otherwise find by email
      subscriber = await Subscriber.findOne({ email });
    }
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }
    
    await subscriber.unsubscribe(reason);
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from all emails'
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Unsubscribe failed'
    });
  }
};

// @desc    Update subscription preferences
// @route   PUT /api/subscribers/:email/preferences
// @access  Public (with token) / Private (admin)
const updatePreferences = async (req, res) => {
  try {
    const { email } = req.params;
    const { preferences, token } = req.body;
    
    let subscriber;
    
    // If token provided, find by token
    if (token) {
      subscriber = await Subscriber.findOne({ unsubscribeToken: token });
    } else if (req.user) {
      // Admin access
      subscriber = await Subscriber.findOne({ email });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Token or authentication required'
      });
    }
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }
    
    await subscriber.updatePreferences(preferences);
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: subscriber.preferences
      }
    });
    
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};

// @desc    Get all subscribers (Admin only)
// @route   GET /api/subscribers
// @access  Private/Admin
const getSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 10, active, verified, source, search } = req.query;
    
    // Build query
    const query = {};
    if (active !== undefined) query.isActive = active === 'true';
    if (verified !== undefined) query.emailVerified = verified === 'true';
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const subscribers = await Subscriber.find(query)
      .select('-emailVerificationToken -unsubscribeToken')
      .sort({ subscribedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Subscriber.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        subscribers,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscribers'
    });
  }
};

// @desc    Get subscriber statistics (Admin only)
// @route   GET /api/subscribers/stats
// @access  Private/Admin
const getSubscriberStats = async (req, res) => {
  try {
    const [generalStats] = await Subscriber.getSubscriberStats();
    const sourceStats = await Subscriber.getSubscribersBySource();
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSubscribers = await Subscriber.countDocuments({
      subscribedAt: { $gte: thirtyDaysAgo }
    });
    
    res.json({
      success: true,
      data: {
        overview: generalStats || {
          total: 0,
          active: 0,
          verified: 0,
          unsubscribed: 0
        },
        sources: sourceStats,
        recentActivity: {
          newSubscribersLast30Days: recentSubscribers
        }
      }
    });
    
  } catch (error) {
    console.error('Get subscriber stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// @desc    Delete subscriber (Admin only)
// @route   DELETE /api/subscribers/:id
// @access  Private/Admin
const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscriber = await Subscriber.findByIdAndDelete(id);
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Subscriber deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscriber'
    });
  }
};

module.exports = {
  subscribe,
  verifyEmail,
  unsubscribe,
  updatePreferences,
  getSubscribers,
  getSubscriberStats,
  deleteSubscriber
};