const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');

// ─────────────────────────────────────────────
// ORDER CONFIRMATION EMAIL TEMPLATE — edit the text/HTML below any time, nothing else needs to change
// ─────────────────────────────────────────────
const buildOrderConfirmationHtml = (customerName, items, total) => {
  const itemsListHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <div style="font-size: 14px; color: #111;">${item.name}</div>
            <div style="font-size: 12px; color: #888; margin-top: 2px;">
              ${item.size ? `Size: ${item.size}` : ""}${item.size && item.color ? " · " : ""}${item.color ? `Color: ${item.color}` : ""} · Qty: ${item.qty}
            </div>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; color: #111;">
            ₦${(item.price * item.qty).toLocaleString()}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img
        src="https://res.cloudinary.com/gam6ajgd/image/upload/v1783698611/MOOD_CLOTH_j8ppzw.png"
        alt="Mood Clothings"
        style="height: 36px; width: auto; display: block; margin-bottom: 28px;"
      />
      <h1 style="font-size: 22px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
        Thank you, ${customerName}!
      </h1>
      <p style="font-size: 15px; line-height: 1.6; color: #444;">
        Your order has been placed successfully. Here's a summary of what's on the way:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        ${itemsListHtml}
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 16px; font-size: 15px; font-weight: bold; color: #111;">
        <span>Total</span>
        <span>₦${total.toLocaleString()}</span>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin-top: 24px;">
        You can expect your order to arrive within <strong>2–3 working days</strong>.
        We'll do our best to get it to you safely and on time.
      </p>

      <p style="font-size: 13px; color: #888; margin-top: 32px;">— The Mood Clothings Team</p>
    </div>
  `;
};

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

    // Fire-and-forget: don't block the response on email sending
    if (customer?.email) {
      sendEmail({
        to: customer.email,
        subject: `Your Mood Clothings order is confirmed`,
        html: buildOrderConfirmationHtml(customer.name || 'there', items, total),
      }).catch((err) => console.error('Order confirmation email failed to send:', err));
    }

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
      { returnDocument: 'after', runValidators: true }
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