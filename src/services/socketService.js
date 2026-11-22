const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Conversation } = require('../db');
const { getJwtSecret } = require('../config/security');
const { buildAllowedOrigins, isAllowedOrigin } = require('../config/cors');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.userSockets = new Map(); // socket.id -> userId
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: (origin, next) => next(null, isAllowedOrigin(origin, buildAllowedOrigins())),
        methods: ["GET", "POST"],
        credentials: false
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, getJwtSecret());
        const user = await User.findByPk(decoded.id);

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('Socket.IO server initialized');
    return this.io;
  }

  handleConnection(socket) {
    const userId = socket.userId;
    
    console.log(`User ${userId} connected with socket ${socket.id}`);
    
    // Store user connection
    this.connectedUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing:stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle conversation events
    socket.on('conversation:join', (conversationId) => {
      this.handleJoinConversation(socket, conversationId).catch(() => {
        socket.emit('conversation:join:error', { code: 'JOIN_FAILED' });
      });
    });

    socket.on('conversation:leave', (conversationId) => {
      this.handleLeaveConversation(socket, conversationId);
    });

    // Handle message read status
    socket.on('message:read', (data) => {
      this.handleMessageRead(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected successfully',
      userId: userId
    });

    // Emit connection status
    socket.emit('connection:status', { connected: true });
  }

  static normalizeConversationId(value) {
    const num = Number(value);
    if (!Number.isSafeInteger(num) || num <= 0 || String(value).trim() !== String(num)) {
      return null;
    }
    return num;
  }

  isMemberOfConversation(socket, conversationId) {
    const id = SocketService.normalizeConversationId(conversationId);
    return id !== null && socket.rooms.has(`conversation:${id}`) ? id : null;
  }

  handleTypingStart(socket, data = {}) {
    const conversationId = this.isMemberOfConversation(socket, data.conversationId);
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      conversationId,
      userId: socket.userId
    });
  }

  handleTypingStop(socket, data = {}) {
    const conversationId = this.isMemberOfConversation(socket, data.conversationId);
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId: socket.userId
    });
  }

  async handleJoinConversation(socket, rawConversationId) {
    const conversationId = SocketService.normalizeConversationId(rawConversationId);
    if (!conversationId) {
      socket.emit('conversation:join:error', { code: 'INVALID_CONVERSATION_ID' });
      return false;
    }

    const conversation = await Conversation.findOne({
      where: { id: conversationId, userId: socket.userId }
      // Sequelize paranoid mode excludes soft-deleted conversations by default.
    });
    if (!conversation) {
      socket.emit('conversation:join:error', { code: 'NOT_AUTHORIZED' });
      return false;
    }
    socket.join(`conversation:${conversationId}`);
    return true;
  }

  handleLeaveConversation(socket, rawConversationId) {
    const conversationId = this.isMemberOfConversation(socket, rawConversationId);
    if (conversationId) socket.leave(`conversation:${conversationId}`);
  }

  handleMessageRead(socket, data = {}) {
    const conversationId = this.isMemberOfConversation(socket, data.conversationId);
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('message:read', {
      conversationId,
      messageId: data.messageId,
      readBy: socket.userId,
      readAt: new Date().toISOString()
    });
  }

  handleDisconnection(socket) {
    const userId = this.userSockets.get(socket.id);
    
    if (userId) {
      console.log(`User ${userId} disconnected`);
      
      // Emit disconnection status before cleaning up
      socket.emit('connection:status', { connected: false });
      
      this.connectedUsers.delete(userId);
      this.userSockets.delete(socket.id);
    }
  }

  // Public methods for emitting events

  // Notify user about new message
  notifyNewMessage(userId, messageData) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(`user:${userId}`).emit('message:new', messageData);
    }
  }

  // Notify conversation participants about new message
  notifyConversationMessage(conversationId, messageData, excludeUserId = null) {
    const room = `conversation:${conversationId}`;
    
    if (excludeUserId) {
      const excludeSocketId = this.connectedUsers.get(excludeUserId);
      if (excludeSocketId) {
        this.io.to(room).except(excludeSocketId).emit('message:new', messageData);
      } else {
        this.io.to(room).emit('message:new', messageData);
      }
    } else {
      this.io.to(room).emit('message:new', messageData);
    }
  }

  // Notify about conversation updates
  notifyConversationUpdate(userId, conversationData) {
    this.io.to(`user:${userId}`).emit('conversation:updated', conversationData);
  }

  // Notify about AI response progress
  notifyAIProgress(userId, conversationId, progress) {
    this.io.to(`user:${userId}`).emit('ai:progress', {
      conversationId,
      progress
    });
  }

  // Broadcast system notifications
  broadcastNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = new SocketService();