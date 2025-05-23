const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegisterAdmin,
  validateLogin,
  validateChangePassword
} = require('../middleware/validation');

// @route   POST /api/auth/register-admin
// @desc    Register admin user (one-time setup)
// @access  Public
router.post('/register-admin', validateRegisterAdmin, registerAdmin);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, login);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public (requires refresh token)
router.post('/refresh', refreshToken);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, logout);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', protect, validateChangePassword, changePassword);

module.exports = router;