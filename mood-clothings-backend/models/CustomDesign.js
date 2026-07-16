// models/CustomDesign.js
const mongoose = require('mongoose');

const customDesignSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  userPhone: { type: String, required: true },
  files: [{
    name: { type: String, required: true },
    url: { type: String, required: true } // Cloudinary / S3 asset storage pointer string
  }],
  notes: { type: String, required: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['Received', 'Under Atelier Review', 'Quote Issued', 'Rejected'], 
    default: 'Received' 
  }
}, { timestamps: true });

module.exports = mongoose.model('CustomDesign', customDesignSchema);