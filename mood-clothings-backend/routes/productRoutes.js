const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

// Route handling for /api/products
router.route('/')
  .get(getProducts)
  .post(createProduct); // Note: We will add admin auth middleware protection here next

// Route handling for /api/products/:id
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)    // Note: Admin protection target
  .delete(deleteProduct); // Note: Admin protection target

module.exports = router;