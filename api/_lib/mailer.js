"use strict";

const nodemailer = require("nodemailer");

const DEFAULT_TO = "info@ssbgroups.in";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let transporter = null;
const rateBuckets = new Map();

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE
    ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
    : port === 465;
  const user = process.env.SMTP_USER || "info@ssbgroups.in";
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    const error = new Error("SMTP_PASS is not configured.");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(getSmtpConfig());
  }
  return transporter;
}

async function sendMail({ to, subject, text, html, replyTo, headers }) {
  const senderAddress = process.env.MAIL_FROM || process.env.SMTP_USER || DEFAULT_TO;
  const senderName = process.env.MAIL_FROM_NAME || "SSB Group Website";
  const recipient = to || process.env.MAIL_TO || DEFAULT_TO;

  return getTransporter().sendMail({
    from: { name: senderName, address: senderAddress },
    to: recipient,
    subject,
    text,
    html,
    replyTo,
    headers,
  });
}

function clean(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 5000) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0].trim();
  }

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function isRateLimited(key, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });

    if (rateBuckets.size > 5000) {
      for (const [bucketKey, value] of rateBuckets) {
        if (value.resetAt <= now) rateBuckets.delete(bucketKey);
      }
    }

    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return null;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function formatDateTime(date = new Date()) {
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)} IST`;
}

function emailLayout({ heading, bodyHtml, preheader = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ed;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ed;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e6ded2;">
          <tr>
            <td style="background:#141a2e;padding:22px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c9a46a;font-weight:bold;">SSB Group</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#ffffff;padding-top:6px;">${escapeHtml(heading)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#333333;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #eee6da;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a8176;">
              SSB Group &middot; B-125, Sector 67, Noida, Uttar Pradesh 201306<br>
              <a href="mailto:info@ssbgroups.in" style="color:#9c7442;text-decoration:none;">info@ssbgroups.in</a> &middot; (+91) 99534 46162
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  DEFAULT_TO,
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
};
