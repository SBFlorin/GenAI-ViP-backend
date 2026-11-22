function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '');
}

function parseOriginList(value) {
  return String(value || '').split(',').map(normalizeOrigin).filter(Boolean);
}

function buildAllowedOrigins() {
  const developmentOrigins = process.env.NODE_ENV === 'production' ? [] : [
    'http://localhost', 'http://localhost:80', 'http://localhost:3000',
    'http://localhost:5173', 'http://127.0.0.1:5173'
  ];
  return Array.from(new Set([
    ...developmentOrigins,
    ...parseOriginList(process.env.CORS_ORIGIN),
    ...parseOriginList(process.env.CLIENT_URL)
  ]));
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true; // non-browser clients do not send an Origin header
  return allowedOrigins.includes(normalizeOrigin(origin));
}

module.exports = { buildAllowedOrigins, isAllowedOrigin };
