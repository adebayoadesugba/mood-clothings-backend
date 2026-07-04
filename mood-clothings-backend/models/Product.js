const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, enum: ['men', 'women', 'unisex'] },
  sub: { type: String, required: true },
  images: [{ type: String, required: true }], // Holds Cloudinary image URLs
  colors: [{ type: String }], // Hex swatch values array
  stockSizes: [{ type: String, enum: ['S', 'M', 'L', 'XL', 'XXL'] }], // Matches checkbox selection matrix
  tags: [{ type: String, enum: ['New Arrival', 'Best Seller', 'Out of Stock'] }],
  sold: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);