require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

// CORS configuration - allow GitHub Pages origin
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://atakan-kaya35.github.io',
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (curl, mobile apps, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(o => origin.startsWith(o))) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-user-id'],
  })
);

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'SKYJO Backend is running!' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lobby', require('./routes/lobby'));
app.use('/api/game', require('./routes/game'));

app.listen(PORT, () => {
  console.log(`SKYJO backend running on port ${PORT}`);
});
