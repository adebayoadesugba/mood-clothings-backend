const Order = require('../models/Order');

// @desc    Create a new customer checkout order
// @route   POST /api/orders
// @access  Private (Logged-in users)
const createOrder = async (req, res, next) => {
  try {
    const { customer, items, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    // Create the order with your exact schema properties
    const order = await Order.create({
      customer,
      items,
      total
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

// @desc    Get order history for the logged-in customer
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    // Look up orders matching the logged-in user's email
    const orders = await Order.find({ 'customer.email': req.user.email });
    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return next(error);
  }
};

// @desc    Get ALL customer checkout orders
// @route   GET /api/orders
// @access  Private (Admin only)
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update an order's fulfillment parameters or tracking index
// @route   PUT /api/orders/:id
// @access  Private (Admin only)
const updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Target order record not found.' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createOrder, getMyOrders, getAllOrders, updateOrder };