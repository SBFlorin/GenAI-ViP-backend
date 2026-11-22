require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');

const cors = require('cors');
const { buildAllowedOrigins, isAllowedOrigin } = require('./config/cors');
const app = express();
const server = http.createServer(app);

const allowedOrigins = buildAllowedOrigins();
const corsOptions = { origin: (origin, next) => next(null, isAllowedOrigin(origin, allowedOrigins)) };
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Serve static files for testing
app.use(express.static('public'));

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/protected', require('./routes/protected'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/chat', require('./routes/chat'));
app.use('/api/v1/evaluator', require('./routes/evaluator'));
app.use('/api/v1/admin/users', require('./routes/adminUsers'));
app.use('/api/v1/admin', require('./routes/adminEvaluator'));
app.use('/api/v1/socket', require('./routes/socket-test'));

// Error handler: honour explicit HTTP statuses (e.g. body-parser 400/413), otherwise 500.
app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ error: 'Internal server error.' });
  }
  res.status(status).json({ error: err.expose === false ? 'Request error.' : err.message, code: err.type || err.code });
});

module.exports = { app, server };
