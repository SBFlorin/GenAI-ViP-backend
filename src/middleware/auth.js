const jwt = require('jsonwebtoken');
const { User } = require('../db');

const { getJwtSecret } = require('../config/security');
const JWT_SECRET = getJwtSecret();

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'paviagen-app'
    });

    // Optional: Verify user still exists and is active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid token or user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Use role from DB (JWT may be stale after role changes)
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

// Optional middleware for endpoints that work with or without auth
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'paviagen-app'
      });
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role
      };
    }

    next();

  } catch (error) {
    // For optional auth, we don't return errors, just proceed without user
    next();
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const normalizeRole = (role) => String(role || '').trim().toLowerCase();
    const userRoles = (Array.isArray(req.user.role) ? req.user.role : [req.user.role]).map(
      normalizeRole
    );
    const requiredRoles = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Deny-list counterpart of requireRole: blocks the given roles, lets every other authenticated role through.
const forbidRoles = (roles) => {
  const normalizeRole = (role) => String(role || '').trim().toLowerCase();
  const forbidden = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }
    if (forbidden.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  forbidRoles
};
