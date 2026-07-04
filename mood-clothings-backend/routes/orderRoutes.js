const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

// Protect both routes so only logged-in users can access them
router.route('/').post(protect, createOrder);
router.route('/myorders').get(protect, getMyOrders);

module.exports = router;