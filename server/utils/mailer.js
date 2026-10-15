const nodemailer = require("nodemailer");

// Logs instead of sending if SMTP isn't configured
const isConfigured =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || "Attendance <no-reply@company.com>";

// Sends an email; logs instead if SMTP isn't configured
async function sendEmail({ to, subject, text, html }) {
  if (!to) return;

  if (!transporter) {
    console.log(`[mailer] SMTP not configured — would have sent "${subject}" to ${to}`);
    return;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, text, html: html || text });
  } catch (error) {
    // Email failures shouldn't break the request
    console.error("[mailer] Failed to send email:", error.message);
  }
}

module.exports = { sendEmail };
