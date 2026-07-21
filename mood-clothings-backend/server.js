const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const customDesignRoutes = require('./routes/customDesignRoutes');
const { handleWebhook } = require('./controllers/paymentController');

const app = express();

// FIXED: without this, Express sees every visitor as coming from Render's shared
// internal proxy IP instead of their real individual IP  which is exactly why one
// device maxing out the rate limit was blocking everyone else too. This tells Express
// to trust Render's proxy and read the real visitor IP from the X-Forwarded-For header.
app.set('trust proxy', 1);

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

// RATE LIMITING: caps how many requests a single IP can make to sensitive auth
// endpoints within a time window. Without this, someone could script thousands of
// login attempts per minute trying to brute-force a password — this makes that
// practically impossible instead of just "not currently happening."
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per window across register/login/google/forgot-password
  standardHeaders: true, // sends standard RateLimit-* headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

// Login specifically gets a tighter limit — it's the single highest-value target
// on the whole site (especially for guessing an admin password).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6, // 6 login attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' },
});

app.use('/api/products', productRoutes);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authLimiter, authRoutes);
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