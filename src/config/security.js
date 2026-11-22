const WEAK_SECRETS = new Set([
  'your_jwt_secret', 'placeholer_jwt_key', 'placeholder_jwt_key',
  'test-secret', 'secret', 'changeme', 'jwt_secret'
]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || WEAK_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET must be set to a strong, non-default value (at least 32 characters).');
  }
  return secret;
}

module.exports = { getJwtSecret };
