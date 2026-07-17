const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  googleAuth,
  forgotPassword,
  resetPassword,
  getAllUsers,
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/users', protect, admin, getAllUsers);

module.exports = router;