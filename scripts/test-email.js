"use strict";

const { sendMail } = require("../api/_lib/mailer");

(async function main() {
    console.log("Sending a test email through Hostinger SMTP...");

    try {
        const info = await sendMail({
            subject: "SSB Group website email test",
            text: [
                "This is a test email from the SSB Group website.",
                "",
                "If you received this message, the contact form and newsletter",
                "are ready to send email.",
            ].join("\n"),
            html: `
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#333;">
                    <div style="background:#141a2e;padding:22px 28px;">
                        <div style="color:#c9a46a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">SSB Group</div>
                        <div style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:24px;padding-top:6px;">Email test successful</div>
                    </div>
                    <div style="padding:28px;border:1px solid #e6ded2;border-top:none;">
                        <p style="margin:0 0 14px;">This is a test email from the SSB Group website.</p>
                        <p style="margin:0;">If you received this message, the contact form and newsletter are ready to send email.</p>
                    </div>
                </div>
            `,
        });

        console.log("Test email sent successfully.");
        console.log(`Message ID: ${info.messageId}`);
        console.log(`Accepted recipients: ${info.accepted ? info.accepted.join(", ") : "unknown"}`);
    } catch (error) {
        console.error("Could not send the test email.");

        if (error && error.code === "SMTP_NOT_CONFIGURED") {
            console.error("SMTP_PASS is empty. Add the info@ssbgroups.in mailbox password to .env.");
        } else if (error && error.code === "EAUTH") {
            console.error("Hostinger rejected the login. Check SMTP_USER and SMTP_PASS in .env.");
        } else {
            console.error(error && error.message ? error.message : error);
        }

        process.exitCode = 1;
    }
})();
