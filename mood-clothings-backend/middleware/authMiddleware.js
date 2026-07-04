const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify if a user is logged in
const protect = async (req, res, next) => {
  let token;

  // Check for token in the HTTP Authorization Header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract the raw token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Decode and verify the token signature
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user details from DB (excluding password) and attach to request object
      req.user = await User.findById(decoded.id).select('-password');
      
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token profile provided' });
  }
};

// Middleware to verify if the logged-in user is an Admin
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required' });
  }
};

module.exports = { protect, admin };