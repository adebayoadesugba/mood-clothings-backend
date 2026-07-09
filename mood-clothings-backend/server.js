const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customDesignRoutes = require('./routes/customDesignRoutes'); // Clean import of the new atelier route file

const app = express();
connectDB();

app.use(cors({
  origin: [
    'http://localhost:8080',
    'https://moodclothings.com',
    'https://www.moodclothings.com'
  ],
  credentials: true
}));
app.use(express.json()); 

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/custom-designs', customDesignRoutes); // Mounted cleanly without interfering with adjacent pipelines

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Error handler MUST be last, after all routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Mood Clothings Backend API engine running smoothly on port ${PORT}`);
});