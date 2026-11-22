const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Settings } = require('../db');

const { getJwtSecret } = require('../config/security');
const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

exports.register = async (req, res, next) => {
  try {
    // `role` is intentionally ignored: self-registration always creates a 'user'.
    // Privileged accounts are created by admins (POST /api/v1/admin/users) or scripts/createUser.js.
    const { email, username, password, firstName, lastName } = req.body;

    // Enhanced validation
    if (!email || !username || !password) {
      return res.status(400).json({ 
        error: 'Email, username, and password are required.',
        details: {
          email: !email ? 'Email is required' : null,
          username: !username ? 'Username is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      } 
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(409).json({ error: `User already exists with this ${field}.` });
    }

    // Hash password with higher salt rounds for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      password: hashedPassword,
      role: 'user',
    });

    // Create default settings for user
    await Settings.create({
      userId: user.id
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username,
        role: user.role 
      }, 
      JWT_SECRET, 
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'paviagen-app'
      }
    );

    res.status(201).json({ 
      message: 'User registered successfully.',
      user: user.toSafeObject(),
      token
    });

  } catch (err) {
    console.error('Registration error:', err);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email or username
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() }
        ]
      } 
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated. Please contact support.' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username,
        role: user.role 
      }, 
      JWT_SECRET, 
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'paviagen-app'
      }
    );

    res.json({ 
      message: 'Login successful. Test deployment.',
      user: user.toSafeObject(),
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    // Verify the existing token (even if expired)
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    
    // Get user to ensure they still exist and are active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    // Generate new token
    const newToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username,
        role: user.role 
      }, 
      JWT_SECRET, 
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'paviagen-app'
      }
    );

    res.json({
      message: 'Token refreshed successfully.',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Settings,
        as: 'settings'
      }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      user: user.toSafeObject(),
      settings: user.settings
    });

  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, username } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if username is taken (if provided and different)
    if (username && username.toLowerCase() !== user.username) {
      const existingUser = await User.findOne({ 
        where: { 
          username: username.toLowerCase(),
          id: { [Op.ne]: user.id }
        } 
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }

      user.username = username.toLowerCase();
    }

    // Update other fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    await user.save();

    res.json({
      message: 'Profile updated successfully.',
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
};
