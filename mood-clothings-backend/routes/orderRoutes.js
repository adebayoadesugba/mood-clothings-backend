const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getAllOrders, updateOrder, deleteOrder } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

// Protect both routes so only logged-in users can access them
router.route('/')
  .post(protect, createOrder)
  .get(protect, admin, getAllOrders); // SECURITY FIX: was missing `admin` -- any logged-in customer could previously see ALL orders

router.route('/myorders').get(protect, getMyOrders);

// Route for modifying order status/tracking fields, or permanently deleting an order, by ID
router.route('/:id')
  .put(protect, admin, updateOrder)   // SECURITY FIX: was missing `admin` -- any logged-in customer could previously edit any order's status
  .delete(protect, admin, deleteOrder); // NEW: admin-only permanent deletion

module.exports = router;