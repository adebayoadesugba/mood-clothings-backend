const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

// Initialize the Express framework
const app = express();

// Connect to your cloud MongoDB instance
connectDB();

// Essential Middleware 
app.use(cors({
  origin: 'http://localhost:5173', // Adjust this if your React Vite app runs on a different port
  credentials: true
}));
app.use(express.json()); // Allows your server to parse incoming JSON data payloads

// Base sanity check route to verify the API server is alive
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global Central Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Set port listener and spin up application threads
const PORT = process.env.PORT || 5000;
app.mixListener = app.listen(PORT, () => {
  console.log(`Mood Clothings Backend API engine running smoothly on port ${PORT}`);
});