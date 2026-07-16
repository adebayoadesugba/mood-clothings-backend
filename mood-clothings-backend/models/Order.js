const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    phone2: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true } // price PER UNIT, trusted/recomputed server-side, never from the client
  }],

  // TRUSTED FINANCIAL FIELDS — all computed server-side from the database, never taken as-is from the client
  // sum of item prices, before VAT      // 7.5% of subtotal
  total: { type: Number, required: true },      // subtotal + vat — this is the exact amount charged via Paystack

  // PAYSTACK PAYMENT TRACKING
  reference: { type: String, unique: true, sparse: true }, // Paystack transaction reference
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },

  status: { 
    type: String, 
    required: true, 
    enum: ['Pending Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending Paid'
  },
  tracking: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);