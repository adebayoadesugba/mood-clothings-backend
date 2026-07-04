const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
// 1. Import your product routes here:
const productRoutes = require('./routes/productRoutes');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');



const app = express();

connectDB();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// 2. Mount your product api routes right here:
app.use('/api/products', productRoutes);

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});


app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Mood Clothings Backend API engine running smoothly on port ${PORT}`);
});