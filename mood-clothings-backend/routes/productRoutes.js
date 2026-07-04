const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

// 1. Import your new security middleware guards:
const { protect, admin } = require('../middleware/authMiddleware');

// Route handling for /api/products
router.route('/')
  .get(getProducts)                  // Anyone can view inventory listings
  .post(protect, admin, createProduct); // ONLY logged-in Admins can add clothes

// Route handling for /api/products/:id
router.route('/:id')
  .get(getProductById)               // Anyone can view a single item's details
  .put(protect, admin, updateProduct)    // ONLY logged-in Admins can edit details
  .delete(protect, admin, deleteProduct); // ONLY logged-in Admins can remove items

module.exports = router;