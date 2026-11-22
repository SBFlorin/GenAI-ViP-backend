const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const ASSIGNABLE_ROLES = ['user', 'evaluator', 'study5', 'study5_rater', 'admin'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function accountError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function assertAssignableRole(role) {
  const normalized = normalizeRole(role);
  if (!ASSIGNABLE_ROLES.includes(normalized)) {
    throw accountError(400, `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`, 'INVALID_ROLE');
  }
  return normalized;
}

/**
 * Creates a user with an explicit role plus its Settings row (same shape as auth register).
 * Used by the admin users API and scripts/createUser.js — never by public self-registration.
 */
async function createUserAccount({ User, Settings }, { email, username, password, firstName, lastName, role }) {
  if (!email || !username || !password) {
    throw accountError(400, 'Email, username, and password are required.', 'MISSING_FIELDS');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw accountError(400, 'Invalid email format.', 'INVALID_EMAIL');
  }
  if (String(password).length < 8) {
    throw accountError(400, 'Password must be at least 8 characters long.', 'WEAK_PASSWORD');
  }
  const normalizedRole = assertAssignableRole(role || 'user');

  const existing = await User.findOne({
    where: { [Op.or]: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] },
    paranoid: false
  });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    throw accountError(409, `User already exists with this ${field}.`, 'USER_EXISTS');
  }

  const user = await User.create({
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    firstName: firstName || '',
    lastName: lastName || '',
    password: await bcrypt.hash(String(password), 12),
    role: normalizedRole
  });
  await Settings.create({ userId: user.id });
  return user;
}

module.exports = {
  ASSIGNABLE_ROLES,
  assertAssignableRole,
  createUserAccount
};
