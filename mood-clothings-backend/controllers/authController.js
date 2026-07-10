const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT string tokens
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ─────────────────────────────────────────────
// WELCOME EMAIL TEMPLATE — edit the text/HTML below any time, nothing else needs to change
// ─────────────────────────────────────────────
const buildWelcomeEmailHtml = (name) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <img
      src="https://res.cloudinary.com/gam6ajgd/image/upload/v1783698611/MOOD_CLOTH_j8ppzw.png"
      alt="Mood Clothings"
      style="height: 36px; width: auto; display: block; margin-bottom: 28px;"
    />
    <h1 style="font-size: 22px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
      Welcome, ${name}!
    </h1>
    <p style="font-size: 15px; line-height: 1.6; color: #444;">
      Thank you for joining Mood Clothings. We're thrilled to have you with us —
      explore our latest collections, save your favorite pieces to your wishlist,
      and enjoy a seamless shopping experience made just for you.
    </p>
    <p style="font-size: 15px; line-height: 1.6; color: #444; margin-top: 16px;">
      If you ever need help, we're just an email away.
    </p>
    <p style="font-size: 13px; color: #888; margin-top: 32px;">— The Mood Clothings Team</p>
  </div>
`;

// @desc    Register a new customer account
// @route   POST /api/auth/register
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Sorry, this email already exists.'
      });
    }

    const user = await User.create({ name, email, password });

    // Fire-and-forget: don't block the response on email sending
    sendEmail({
      to: user.email,
      subject: `Welcome to Mood Clothings, ${user.name.split(' ')[0]}!`,
      html: buildWelcomeEmailHtml(user.name.split(' ')[0]),
    }).catch((err) => console.error('Welcome email failed to send:', err));

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      data: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account was created with Google. Please use "Continue with Google" to sign in.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      data: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sign in / sign up with Google — verifies the credential server-side,
//          then finds an existing user or creates a brand-new one.
// @route   POST /api/auth/google
const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'No Google credential provided.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNewUser = false;

    if (!user) {
      user = await User.create({ name, email, googleId });
      isNewUser = true;
    } else if (!user.googleId) {
      // Existing email/password account signing in with Google for the first time — link it
      user.googleId = googleId;
      await user.save();
    }

    if (isNewUser) {
      sendEmail({
        to: user.email,
        subject: `Welcome to Mood Clothings, ${user.name.split(' ')[0]}!`,
        html: buildWelcomeEmailHtml(user.name.split(' ')[0]),
      }).catch((err) => console.error('Welcome email failed to send:', err));
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      data: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Google auth verification failed:', error);
    return res.status(401).json({ success: false, message: 'Google sign-in verification failed.' });
  }
};

// @desc    Request a password reset — sends an email with a reset link IF the account exists.
//          If it doesn't exist, tells the frontend so it can prompt sign-up instead.
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please sign up instead.'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in and has no password to reset. Please use "Continue with Google".'
      });
    }

    // Generate a raw token to email the user, and store only its hash in the DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
    const resetUrl = `${FRONTEND_URL}/reset-password/${rawToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <img
          src="https://res.cloudinary.com/gam6ajgd/image/upload/v1783698611/MOOD_CLOTH_j8ppzw.png"
          alt="Mood Clothings"
          style="height: 36px; width: auto; display: block; margin-bottom: 28px;"
        />
        <h1 style="font-size: 20px; letter-spacing: 0.05em; text-transform: uppercase;">Reset your password</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #444;">
          We received a request to reset the password for your Mood Clothings account.
          This link expires in 30 minutes.
        </p>
        <a href="${resetUrl}" style="display: inline-block; margin-top: 20px; background: #111; color: #fff; padding: 12px 24px; text-decoration: none; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em;">
          Reset Password
        </a>
        <p style="font-size: 13px; color: #888; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Reset your Mood Clothings password',
      html,
    });

    if (!emailResult.success) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.' });
    }

    return res.status(200).json({ success: true, message: 'Password reset email sent.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using the token emailed to the user
// @route   POST /api/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in.',
      token: generateToken(user._id),
      data: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, googleAuth, forgotPassword, resetPassword };