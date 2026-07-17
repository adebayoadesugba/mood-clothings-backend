const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const customDesignRoutes = require('./routes/customDesignRoutes');
const { handleWebhook } = require('./controllers/paymentController');

const app = express();

connectDB();

app.use(cors({
  origin: ['http://localhost:8080', 'https://moodclothings.com', 'https://www.moodclothings.com'],
  credentials: true
}));

// PAYSTACK WEBHOOK: must be registered BEFORE express.json(), and must use express.raw()
// instead of express.json() for this one route specifically. Paystack signs the exact raw
// bytes of the request body — if Express re-serializes the JSON before we verify the
// signature, the bytes won't match and every real webhook would fail verification.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body; // express.raw() gives us a Buffer here, which is exactly what we need
    next();
  },
  handleWebhook
);

// Every other route can safely use normal JSON parsing
app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/custom-designs', customDesignRoutes);

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