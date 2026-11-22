/**
 * Security prerequisites (role assignment, admin-only settings writes, admin user management).
 * Runs the Express app in-process against an in-memory SQLite DB.
 *   node test_security_prereqs.js
 */
process.env.SQLITE_STORAGE = ':memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-test-secret-please-replace-not-for-production-2026';

const { app } = require('./src/app');
const { sequelize, User, Settings } = require('./src/db');
const { createUserAccount } = require('./src/services/userAccountService');
const { forbidRoles } = require('./src/middleware/auth');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

async function main() {
  await sequelize.sync();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  };

  try {
    const reg = await call('POST', '/auth/register', {
      body: { email: 'mallory@example.com', username: 'mallory', password: 'password123', role: 'admin' }
    });
    assert(reg.status === 201 || reg.status === 200, 'self-registration succeeds');
    const mallory = await User.findOne({ where: { email: 'mallory@example.com' } });
    assert(mallory.role === 'user', 'role in register body is ignored (user created as "user")');

    const userToken = reg.data.token;
    const reset = await call('POST', '/settings/reset', { token: userToken });
    assert(reset.status === 403, 'non-admin cannot reset settings');
    const put = await call('PUT', '/settings', { token: userToken, body: { sessionTimeout: 1 } });
    assert(put.status === 403, 'non-admin cannot overwrite settings');
    const patch = await call('PATCH', '/settings/health-profile', { token: userToken, body: {} });
    assert(patch.status === 403, 'non-admin cannot patch health profile');
    const createAsUser = await call('POST', '/admin/users', {
      token: userToken,
      body: { email: 'x@example.com', username: 'x', password: 'password123', role: 'admin' }
    });
    assert(createAsUser.status === 403, 'non-admin cannot create users');

    await createUserAccount({ User, Settings }, {
      email: 'admin@example.com', username: 'admin', password: 'password123', role: 'admin'
    });
    const login = await call('POST', '/auth/login', { body: { email: 'admin@example.com', password: 'password123' } });
    assert(login.status === 200 && login.data.token, 'admin can log in');
    const adminToken = login.data.token;

    const created = await call('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'lab1@example.com', username: 'lab1', password: 'password123', role: 'study5' }
    });
    assert(created.status === 201 && created.data.user.role === 'study5', 'admin creates a study5 account');
    const badRole = await call('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'lab2@example.com', username: 'lab2', password: 'password123', role: 'superuser' }
    });
    assert(badRole.status === 400, 'unknown roles are rejected');
    const dup = await call('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'lab1@example.com', username: 'lab1b', password: 'password123', role: 'study5' }
    });
    assert(dup.status === 409, 'duplicate email rejected');
    const roleChange = await call('PATCH', `/admin/users/${mallory.id}/role`, { token: adminToken, body: { role: 'evaluator' } });
    assert(roleChange.status === 200 && roleChange.data.user.role === 'evaluator', 'admin changes a role');
    const list = await call('GET', '/admin/users', { token: adminToken });
    assert(list.status === 200 && list.data.users.length === 3 && !('password' in list.data.users[0]), 'admin lists users without password hashes');
    const adminReset = await call('POST', '/settings/reset', { token: adminToken });
    assert(adminReset.status === 200, 'admin can still reset settings');

    const badJson = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert(badJson.status === 400, 'malformed JSON returns 400 instead of 500');

    let statusSent = null;
    const fakeRes = { status(code) { statusSent = code; return { json() {} }; } };
    let passed = false;
    forbidRoles(['study5'])({ user: { role: 'Study5' } }, fakeRes, () => { passed = true; });
    assert(!passed && statusSent === 403, 'forbidRoles blocks listed roles (case-insensitive)');
    passed = false;
    forbidRoles(['study5'])({ user: { role: 'user' } }, fakeRes, () => { passed = true; });
    assert(passed, 'forbidRoles lets other roles through');
  } finally {
    server.close();
    await sequelize.close();
  }
  console.log('\nAll security prerequisite tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
