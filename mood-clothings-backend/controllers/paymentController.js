const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// ─────────────────────────────────────────────
// ORDER CONFIRMATION EMAIL TEMPLATE — no VAT breakdown, just line items + total
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
        Your payment has been confirmed and your order is being prepared. Here's a summary:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        ${itemsListHtml}
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 16px; font-size: 15px; font-weight: bold; color: #111;">
        <span>Total Paid </span><span> ₦${total.toLocaleString()}</span>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin-top: 24px;">
        You can expect your order to arrive within <strong>2–3 working days</strong>.
        Please note a delivery fee of <strong>₦1,000 – ₦5,000</strong> (based on your location) is payable directly
        to the courier upon delivery.
      </p>

      <p style="font-size: 13px; color: #888; margin-top: 32px;">— The Mood Clothings Team</p>
    </div>
  `;
};

// Recomputes a fully trusted order total from the database — NEVER from anything the client sends.
// This is the core anti-tampering measure: even if someone edits cart prices/totals in DevTools
// before submitting, this function ignores that entirely and looks up real, current prices.
const buildTrustedOrderFromItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const trustedItems = [];
  let total = 0;

  for (const rawItem of rawItems) {
    const product = await Product.findById(rawItem.product);
    if (!product) {
      throw new Error(`One of the items in your cart is no longer available.`);
    }

    const qty = Math.max(1, parseInt(rawItem.qty, 10) || 1);
    const unitPrice = product.price; // trusted, straight from the database — client-sent price is ignored entirely

    trustedItems.push({
      product: product._id,
      name: product.name,
      image: Array.isArray(product.images) && product.images[0] ? product.images[0] : '',
      color: rawItem.color || 'Default',
      size: rawItem.size || 'M',
      qty,
      price: unitPrice,
    });

    total += unitPrice * qty;
  }

  return { trustedItems, total };
};

// Shared fulfillment logic used by BOTH the verify endpoint and the webhook, so payment
// confirmation is handled identically and idempotently no matter which path triggers it first.
const finalizeSuccessfulPayment = async (paystackData) => {
  const { reference, amount } = paystackData;

  const order = await Order.findOne({ reference });
  if (!order) {
    console.error(`Webhook/verify received unknown reference: ${reference}`);
    return null;
  }

  // IDEMPOTENCY GUARD: if this order was already marked paid (e.g. the callback already
  // processed it before the webhook arrived, or vice versa), don't re-process or re-email.
  if (order.paymentStatus === 'paid') {
    return order;
  }

  // AMOUNT VERIFICATION: the amount Paystack confirms was actually charged must match
  // EXACTLY what we calculated server-side when we initialized this transaction.
  // Paystack amounts are in kobo; our stored total is in naira.
  if (amount !== order.total * 100) {
    console.error(
      `Amount mismatch for reference ${reference}: Paystack confirms ${amount} kobo, order expects ${order.total * 100} kobo. Payment NOT accepted.`
    );
    order.paymentStatus = 'failed';
    await order.save();
    return null;
  }

  order.paymentStatus = 'paid';
  await order.save();

  sendEmail({
    to: order.customer.email,
    subject: `Your Mood Clothings order is confirmed`,
    html: buildOrderConfirmationHtml(order.customer.name, order.items, order.total),
  }).catch((err) => console.error('Order confirmation email failed to send:', err));

  return order;
};

// @desc    Recompute a trusted total from real product prices, create a pending order,
//          and initialize a Paystack transaction for the EXACT trusted amount.
// @route   POST /api/payments/initialize
// @access  Private
const initializePayment = async (req, res, next) => {
  try {
    const { customer, items } = req.body;

    if (!customer?.email || !customer?.name || !customer?.phone || !customer?.address || !customer?.city) {
      return res.status(400).json({ success: false, message: 'Missing required customer details.' });
    }

    if (customer.phone2 && customer.phone2.trim() === customer.phone.trim()) {
      return res.status(400).json({ success: false, message: 'Primary and alternative phone numbers must be different.' });
    }

    const { trustedItems, total } = await buildTrustedOrderFromItems(items);

    // Create the order in a 'pending' state BEFORE contacting Paystack, so we always
    // have a record even if the payment step fails or is abandoned.
    const order = await Order.create({
      customer,
      items: trustedItems,
      total,
      paymentStatus: 'pending',
    });

    // Get the frontend origin from the request headers, or fall back to an env variable
    const FRONTEND_URL = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';

    const paystackRes = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customer.email,
        amount: total * 100, // Paystack expects kobo
        callback_url: `${FRONTEND_URL}/checkout/callback`, // <-- Dynamic redirection!
        metadata: { orderId: order._id.toString() },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      order.paymentStatus = 'failed';
      await order.save();
      throw new Error(paystackData.message || 'Unable to initialize payment with Paystack.');
    }

    // Store Paystack's generated reference against our order so verify/webhook can find it later
    order.reference = paystackData.data.reference;
    await order.save();

    return res.status(200).json({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    });
  } catch (error) {
    if (error.message && !error.status) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

// @desc    Verify a transaction directly with Paystack (used when the customer is
//          redirected back to our callback page after paying).
// @route   GET /api/payments/verify/:reference
// @access  Private
const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const paystackRes = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      return res.status(400).json({ success: false, message: 'Unable to verify transaction with Paystack.' });
    }

    const { status, amount, reference: confirmedReference } = paystackData.data;

    if (status !== 'success') {
      return res.status(200).json({ success: false, message: 'Payment was not successful.' });
    }

    const order = await finalizeSuccessfulPayment({ reference: confirmedReference, amount });

    if (!order) {
      return res.status(400).json({ success: false, message: 'Payment could not be confirmed. Please contact support.' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

// @desc    Receive Paystack's server-to-server webhook notification.
//          This is the reliable backup path — bank transfers/USSD can confirm minutes
//          after the customer leaves the page, so this catches those cases even if the
//          customer never makes it back to our callback URL.
// @route   POST /api/payments/webhook
// @access  Public (but verified via signature — Paystack, not a logged-in user, calls this)
const handleWebhook = async (req, res) => {
  try {
    // SIGNATURE VERIFICATION: confirms this request genuinely came from Paystack and
    // wasn't forged by someone POSTing a fake "success" event directly to this URL.
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Webhook signature mismatch — possible spoofed request.');
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.rawBody.toString());

    if (event.event === 'charge.success') {
      await finalizeSuccessfulPayment({
        reference: event.data.reference,
        amount: event.data.amount,
      });
    }

    // Always respond 200 quickly so Paystack doesn't endlessly retry
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(200).send('OK'); // still 200 — we log the error but don't want retries on our own bugs
  }
};

module.exports = { initializePayment, verifyPayment, handleWebhook };