const config = require('./config/env');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const journeyRoutes = require('./routes/journey');
const trainRoutes = require('./routes/trains');
const sequelize = require('./config/database');

const app = express();
const PORT = config.PORT;

// Middleware
const corsOrigin = config.CORS_ORIGIN === '*' 
  ? '*' 
  : config.CORS_ORIGIN.split(',').map(s => s.trim());

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));
app.use(express.json());

// Health & Info endpoints
app.get(['/', '/api', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'RailSafe API',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Mount routes with and without /api prefix for maximum routing compatibility
app.use('/api/auth', authRoutes);
app.use('/api/journey', journeyRoutes);
app.use('/api/trains', trainRoutes);

app.use('/auth', authRoutes);
app.use('/journey', journeyRoutes);
app.use('/trains', trainRoutes);

// Fallback route mounts for any rewrite variations (/api/search)
app.use('/api', trainRoutes);

// Global 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    msg: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    msg: err.message || 'Internal server error'
  });
});

// Non-blocking database connection so serverless function starts instantly
if (process.env.VERCEL && !config.DATABASE_URL && !config.DB_HOST) {
  console.log('Serverless environment without external database configured. Using verified demo and bundled train data.');
} else {
  sequelize.authenticate()
    .then(() => {
      console.log('Connected to MySQL database');
      return sequelize.sync();
    })
    .then(() => {
      console.log('Database models synchronized');
    })
    .catch((err) => {
      console.warn('Database connection warning (falling back to mock/demo data):', err.message);
    });
}

// Start listening if run directly (local development)
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export app for Vercel serverless / multi-service deployment
module.exports = app;

