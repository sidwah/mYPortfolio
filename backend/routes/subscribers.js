const express = require('express');
const router = express.Router();
const {
  subscribe,
  verifyEmail,
  unsubscribe,
  updatePreferences,
  getSubscribers,
  getSubscriberStats,
  deleteSubscriber
} = require('../controllers/subscriberController');
const { protect, adminOnly } = require('../middleware/auth');
const {
  validateSubscribe,
  validateUnsubscribe,
  validateMongoId,
  validatePagination
} = require('../middleware/validation');

// Public routes
// @route   POST /api/subscribers
// @desc    Subscribe to newsletter
// @access  Public
router.post('/', validateSubscribe, subscribe);

// @route   GET /api/subscribers/verify/:token
// @desc    Verify email subscription
// @access  Public
router.get('/verify/:token', verifyEmail);

// @route   DELETE /api/subscribers/:email
// @desc    Unsubscribe from newsletter
// @access  Public
router.delete('/:email', validateUnsubscribe, unsubscribe);

// @route   PUT /api/subscribers/:email/preferences
// @desc    Update subscription preferences
// @access  Public (with token) / Private (admin)
router.put('/:email/preferences', updatePreferences);

// Admin only routes
// @route   GET /api/subscribers
// @desc    Get all subscribers
// @access  Private/Admin
router.get('/', protect, adminOnly, validatePagination, getSubscribers);

// @route   GET /api/subscribers/stats
// @desc    Get subscriber statistics
// @access  Private/Admin
router.get('/stats', protect, adminOnly, getSubscriberStats);

// @route   DELETE /api/subscribers/:id
// @desc    Delete subscriber
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, validateMongoId, deleteSubscriber);

module.exports = router;