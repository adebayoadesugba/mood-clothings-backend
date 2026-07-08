const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getAllOrders, updateOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

// Protect both routes so only logged-in users can access them
router.route('/')
  .post(protect, createOrder)
  .get(protect, getAllOrders);

router.route('/myorders').get(protect, getMyOrders);

// Route for modifying order status or tracking fields by ID
router.route('/:id').put(protect, updateOrder);

module.exports = router;