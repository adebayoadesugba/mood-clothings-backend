const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Password is now OPTIONAL: Google-signup users will have no password at all
  password: {
    type: String,
    required: function () { return !this.googleId; },
    minlength: 6,
  },

  // Set only for users who signed up / signed in via Google
  googleId: { type: String, unique: true, sparse: true },

  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },

  // Password reset support
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
}, { timestamps: true });

// Document Middleware: Clean async password hashing for Mongoose 9+
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance Method: Helper function to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // Google-only accounts have no password to match
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);