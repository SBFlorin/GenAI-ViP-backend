const express = require('express');
const router = express.Router();
const socketService = require('../services/socketService');
const { authenticateToken } = require('../middleware/auth');

// Test endpoint to verify Socket.IO integration
router.get('/socket-test', authenticateToken, (req, res) => {
  try {
    const isOnline = socketService.isUserOnline(req.user.id);
    const onlineCount = socketService.getOnlineUsersCount();
    
    // Send a test notification
    socketService.broadcastNotification(req.user.id, {
      type: 'info',
      message: 'Socket.IO test notification',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Socket.IO integration test',
      userOnline: isOnline,
      totalOnlineUsers: onlineCount,
      socketInitialized: socketService.io !== null
    });
  } catch (error) {
    console.error('Socket test error:', error);
    res.status(500).json({ error: 'Socket test failed' });
  }
});

module.exports = router;