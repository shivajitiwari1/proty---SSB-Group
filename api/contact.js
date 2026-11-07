"use strict";

const {
  clean,
  cleanMultiline,
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed." });
  }

  const body = parseBody(req);

  if (!body) {
    return sendJson(res, 400, { ok: false, error: "Invalid request." });
  }

  const requestId = req.headers["x-vercel-id"] || "-";
  const ip = getClientIp(req);

  // Hidden honeypot field: real visitors never fill this in.
  if (clean(body.ssb_hp, 200)) {
    console.warn(`[contact] Honeypot dropped a submission. requestId=${requestId} ip=${ip}`);
    return sendJson(res, 200, { ok: true });
  }

  // Older cached pages still send the previous `website` field. It is only
  // logged, not treated as spam, because browser autofill can fill it.
  if (clean(body.website, 200)) {
    console.info(`[contact] Ignoring legacy website field. requestId=${requestId} ip=${ip}`);
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 40);
  const message = cleanMultiline(body.message, 5000);

  if (!name || !email || !phone || !message) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please fill in your name, email, phone number and message.",
    });
  }

  if (!isValidEmail(email)) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please enter a valid email address.",
    });
  }

  if (name.length < 2) {
    return sendJson(res, 400, { ok: false, error: "Please enter your full name." });
  }

  const phoneDigits = phone.replace(/\D/g, "");

  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please enter a valid phone number (7–15 digits).",
    });
  }

  if (!/^[+()\d\s.\-]+$/.test(phone)) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please enter a valid phone number.",
    });
  }

  if (message.length < 5) {
    return sendJson(res, 400, {
      ok: false,
      error: "Please add a short message so our team can help.",
    });
  }

  if (isRateLimited(`contact:${ip}`, 5, 10 * 60 * 1000)) {
    return sendJson(res, 429, {
      ok: false,
      error: "Too many requests. Please try again in a few minutes or email info@ssbgroups.in.",
    });
  }

  const submittedAt = formatDateTime();
  const subject = `New website enquiry from ${name}`;
  const replySubject = encodeURIComponent(`Re: ${subject}`);
  const mailtoHref = `mailto:${email}?subject=${replySubject}`;

  const text = [
    "New website enquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Submitted: ${submittedAt}`,
    "",
    "Message:",
    message,
    "",
    "--",
    "Sent from the SSB Group website contact form.",
  ].join("\n");

  const html = emailLayout({
    heading: "New website enquiry",
    preheader: `${name} sent an enquiry from the SSB Group website.`,
    bodyHtml: `
      <p style="margin:0 0 20px;">You have a new enquiry from the SSB Group website.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;width:110px;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Name</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;font-weight:bold;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;"><a href="mailto:${escapeHtml(email)}" style="color:#9c7442;text-decoration:none;">${escapeHtml(email)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Phone</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;"><a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" style="color:#9c7442;text-decoration:none;">${escapeHtml(phone)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#8a8176;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Submitted</td>
          <td style="padding:10px 0;">${escapeHtml(submittedAt)}</td>
        </tr>
      </table>
      <div style="margin:24px 0 0;padding:18px 20px;background:#faf8f4;border-left:3px solid #9c7442;">
        <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#8a8176;padding-bottom:8px;">Message</div>
        <div style="white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>
      <p style="margin:26px 0 0;">
        <a href="${escapeHtml(mailtoHref)}" style="display:inline-block;background:#9c7442;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:28px;font-weight:bold;">Reply to ${escapeHtml(name)}</a>
      </p>
      <p style="margin:22px 0 0;font-size:12px;color:#8a8176;">Sent from the SSB Group website contact form.</p>
    `,
  });

  try {
    const info = await sendMail({
      subject,
      text,
      html,
      replyTo: email,
    });

    console.log(
      `[contact] Enquiry sent. requestId=${requestId} ip=${ip} messageId=${info && info.messageId} ` +
        `accepted=${JSON.stringify(info && info.accepted)} rejected=${JSON.stringify(info && info.rejected)} ` +
        `response=${info && info.response}`
    );

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error && error.code === "SMTP_NOT_CONFIGURED") {
      console.error("[contact] SMTP_PASS is not configured.");
      return sendJson(res, 500, {
        ok: false,
        error: "Email is not configured yet. Please email us directly at info@ssbgroups.in.",
      });
    }

    console.error("[contact] Failed to send enquiry:", error);
    return sendJson(res, 500, {
      ok: false,
      error: "We couldn't send your message right now. Please email info@ssbgroups.in or try again shortly.",
    });
  }
};
