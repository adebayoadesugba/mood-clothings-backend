// Uses Resend (resend.com) — free tier: 100 emails/day, 3,000/month, no card required.
// 1. Sign up at resend.com
// 2. Verify a sending domain OR use their default onboarding@resend.dev sender for testing
// 3. Copy your API key into your backend's environment variables as RESEND_API_KEY

const sendEmail = async ({ to, subject, html }) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Mood Clothings <welcome@contact.moodclothings.com>';

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set email was not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Email sending failed:', err);
    return { success: false, error: err.message };
  }
};

module.exports = sendEmail;
