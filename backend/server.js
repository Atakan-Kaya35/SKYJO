require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
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
