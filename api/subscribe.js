"use strict";

const {
  DEFAULT_TO,
  clean,
  emailLayout,
  escapeHtml,
  formatDateTime,
  getClientIp,
  isRateLimited,
  isValidEmail,
  parseBody,
  sendJson,
  sendMail,
} = require("./_lib/mailer");

function isOptedIn(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "on";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed." });
  }

  const body = parseBody(req);

  if (!body) {
    return sendJson(res, 400, { ok: false, error: "Invalid request." });
  }

  // Hidden honeypot field: real visitors never fill this in.
  if (clean(body.website, 200)) {
    return sendJson(res, 200, { ok: true });
  }

  const email = clean(body.email, 254).toLowerCase();

  if (!email) {
    return sendJson(res, 400, { ok: false, error: "Please enter your email address." });
  }

  if (!isValidEmail(email)) {
    return sendJson(res, 400, { ok: false, error: "Please enter a valid email address." });
  }

  if (!isOptedIn(body.optIn)) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please agree to the terms and conditions to subscribe.",
    });
  }

  const ip = getClientIp(req);

  if (isRateLimited(`subscribe:ip:${ip}`, 5, 10 * 60 * 1000)) {
    return sendJson(res, 429, {
      ok: false,
      error: "Too many requests. Please try again in a few minutes.",
    });
  }

  if (isRateLimited(`subscribe:email:${email}`, 2, 60 * 60 * 1000)) {
    return sendJson(res, 429, {
      ok: false,
      error: "This email address has already been submitted. Please check your inbox.",
    });
  }

  const subscribedAt = formatDateTime();
  const mailTo = process.env.MAIL_TO || DEFAULT_TO;

  const internalText = [
    "New newsletter subscription",
    "",
    `Email: ${email}`,
    `Subscribed: ${subscribedAt}`,
    "Source: Website footer newsletter form",
  ].join("\n");

  const internalHtml = emailLayout({
    heading: "New newsletter subscriber",
    preheader: `${email} subscribed to SSB Group updates.`,
    bodyHtml: `
      <p style="margin:0 0 20px;">A visitor subscribed to the SSB Group newsletter from the website footer.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;width:110px;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;font-weight:bold;"><a href="mailto:${escapeHtml(email)}" style="color:#9c7442;text-decoration:none;">${escapeHtml(email)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Subscribed</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;">${escapeHtml(subscribedAt)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Source</td>
          <td style="padding:10px 0;">Website footer newsletter form</td>
        </tr>
      </table>
      <p style="margin:22px 0 0;font-size:12px;color:#8a8176;">A welcome email was also sent to the subscriber.</p>
    `,
  });

  try {
    await sendMail({
      subject: `New newsletter subscriber: ${email}`,
      text: internalText,
      html: internalHtml,
      replyTo: email,
    });
  } catch (error) {
    if (error && error.code === "SMTP_NOT_CONFIGURED") {
      console.error("[subscribe] SMTP_PASS is not configured.");
      return sendJson(res, 500, {
        ok: false,
        error: "Email is not configured yet. Please email us directly at info@ssbgroups.in.",
      });
    }

    console.error("[subscribe] Failed to send subscriber notification:", error);
    return sendJson(res, 500, {
      ok: false,
      error: "We couldn't save your subscription right now. Please try again shortly.",
    });
  }

  const welcomeText = [
    "Hello,",
    "",
    "Thank you for subscribing to SSB Group updates.",
    "",
    "You'll be the first to hear about:",
    "- New project launches across Delhi-NCR",
    "- Construction milestones and delivery updates",
    "- Market insights and investment opportunities",
    "",
    "We'll only send useful updates, never spam.",
    "",
    "If you have any questions, simply reply to this email or write to info@ssbgroups.in.",
    "",
    "Warm regards,",
    "SSB Group",
    "B-125, Sector 67, Noida, Uttar Pradesh 201306",
    "(+91) 99534 46162",
    "",
    "You are receiving this email because you subscribed to updates at ssbgroups.in.",
    'To unsubscribe, reply to this email with "Unsubscribe".',
  ].join("\n");

  const welcomeHtml = emailLayout({
    heading: "You're on the list",
    preheader: "Thank you for subscribing to SSB Group updates.",
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello,</p>
      <p style="margin:0 0 16px;">Thank you for subscribing to <strong>SSB Group</strong> updates. You'll be the first to hear about our work across Delhi-NCR.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:#faf8f4;border-left:3px solid #9c7442;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-weight:bold;color:#141a2e;padding-bottom:10px;">What you'll receive</div>
            <div style="padding:4px 0;">&bull; New project launches across Delhi-NCR</div>
            <div style="padding:4px 0;">&bull; Construction milestones and delivery updates</div>
            <div style="padding:4px 0;">&bull; Market insights and investment opportunities</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;">We'll only send useful updates, never spam.</p>
      <p style="margin:0 0 24px;">If you have any questions, simply reply to this email or write to <a href="mailto:info@ssbgroups.in" style="color:#9c7442;">info@ssbgroups.in</a>.</p>
      <p style="margin:0;">Warm regards,<br><strong>SSB Group</strong><br>B-125, Sector 67, Noida, Uttar Pradesh 201306<br>(+91) 99534 46162</p>
      <p style="margin:24px 0 0;font-size:12px;color:#8a8176;">You are receiving this email because you subscribed to updates at ssbgroups.in. To unsubscribe, reply to this email with &ldquo;Unsubscribe&rdquo;.</p>
    `,
  });

  try {
    await sendMail({
      to: email,
      subject: "Welcome to SSB Group updates",
      text: welcomeText,
      html: welcomeHtml,
      replyTo: mailTo,
      headers: {
        "List-Unsubscribe": `<mailto:${mailTo}?subject=Unsubscribe>`,
      },
    });
  } catch (error) {
    // The subscription was recorded successfully; don't fail the request if
    // only the visitor's welcome email could not be delivered.
    console.error("[subscribe] Welcome email failed:", error);
  }

  return sendJson(res, 200, { ok: true });
};
