const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Note: the /webhook route is intentionally NOT here — it's mounted directly in server.js
// with raw-body parsing, since Paystack's signature verification needs the exact raw bytes.

router.post('/initialize', protect, initializePayment);
router.get('/verify/:reference', protect, verifyPayment);

module.exports = router;
