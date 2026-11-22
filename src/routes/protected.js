const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  res.json({ 
    message: `Hello, ${req.user.username || req.user.email}. This is a protected route.`,
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role
    }
  });
});

router.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: 'Welcome to your dashboard',
    data: {
      userId: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
