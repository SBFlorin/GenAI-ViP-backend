const { User, Settings } = require('../db');
const { assertAssignableRole, createUserAccount } = require('../services/userAccountService');

function toAdminView(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ users: users.map(toAdminView) });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const user = await createUserAccount({ User, Settings }, req.body || {});
    console.info(`[admin-users] user ${user.id} created with role ${user.role} by admin ${req.user.id}`);
    res.status(201).json({ user: toAdminView(user) });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const role = assertAssignableRole(req.body?.role);
    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Admins cannot remove their own admin role.' });
    }
    const previousRole = user.role;
    user.role = role;
    await user.save();
    console.info(`[admin-users] user ${user.id} role ${previousRole} -> ${role} by admin ${req.user.id}`);
    res.json({ user: toAdminView(user) });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
};
