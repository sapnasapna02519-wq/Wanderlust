const nodemailer = require("nodemailer");

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendResetEmail({ to, resetLink }) {
  const transporter = buildTransport();
  if (!transporter) return { sent: false, reason: "missing_smtp" };

  const appName = process.env.APP_NAME || "Wanderlust";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `${appName}: Reset your password`;
  const text = [
    `You requested a password reset for ${appName}.`,
    "",
    `Reset link: ${resetLink}`,
    "",
    "This link expires in 30 minutes.",
    "If you did not request this, ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f8f8f8; padding:24px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #ececec; border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(120deg,#ff385c,#e31c5f); color:#ffffff; padding:18px 20px;">
          <h2 style="margin:0; font-size:20px;">${appName}</h2>
          <p style="margin:6px 0 0 0; font-size:14px; opacity:0.9;">Password Reset Request</p>
        </div>
        <div style="padding:20px;">
          <p style="margin:0 0 12px 0; color:#222;">You requested to reset your password.</p>
          <p style="margin:0 0 16px 0; color:#555;">This link expires in <strong>30 minutes</strong>.</p>
          <p style="margin:0 0 18px 0;">
            <a href="${resetLink}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:600;">Reset Password</a>
          </p>
          <p style="margin:0 0 8px 0; color:#666; font-size:13px;">If the button does not work, use this URL:</p>
          <p style="margin:0; word-break:break-all; font-size:13px;"><a href="${resetLink}">${resetLink}</a></p>
        </div>
        <div style="padding:12px 20px; border-top:1px solid #efefef; color:#777; font-size:12px;">
          If you did not request this, you can ignore this email.
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function sendBookingStatusEmail({
  to,
  status,
  bookingId,
  listingTitle,
  location,
  country,
  checkIn,
  checkOut,
  guests,
  totalPrice,
}) {
  const transporter = buildTransport();
  if (!transporter) return { sent: false, reason: "missing_smtp" };

  const appName = process.env.APP_NAME || "Wanderlust";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const statusLabel = status === "cancelled" ? "Cancelled" : "Confirmed";
  const subject = `${appName}: Booking ${statusLabel}`;
  const destination = `${location || ""}${country ? `, ${country}` : ""}`.trim();
  const total = Number(totalPrice || 0).toLocaleString("en-IN");

  const text = [
    `Your booking is ${statusLabel.toLowerCase()}.`,
    "",
    `Booking ID: ${bookingId}`,
    `Listing: ${listingTitle || "Listing"}`,
    `Location: ${destination || "N/A"}`,
    `Check-in: ${formatDate(checkIn)}`,
    `Check-out: ${formatDate(checkOut)}`,
    `Guests: ${guests || 1}`,
    `Total: INR ${total}`,
  ].join("\n");

  const badgeColor = status === "cancelled" ? "#d12c2c" : "#1f7a43";
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f8f8f8; padding:24px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #ececec; border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(120deg,#ff385c,#e31c5f); color:#ffffff; padding:18px 20px;">
          <h2 style="margin:0; font-size:20px;">${appName}</h2>
          <p style="margin:6px 0 0 0; font-size:14px; opacity:0.9;">Booking ${statusLabel}</p>
        </div>
        <div style="padding:20px;">
          <p style="margin:0 0 14px 0; color:#222;">
            Your booking is
            <strong style="color:${badgeColor};">${statusLabel}</strong>.
          </p>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td style="padding:6px 0; color:#666;">Booking ID</td><td style="padding:6px 0; color:#111; text-align:right;">${bookingId}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Listing</td><td style="padding:6px 0; color:#111; text-align:right;">${listingTitle || "Listing"}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Location</td><td style="padding:6px 0; color:#111; text-align:right;">${destination || "N/A"}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Check-in</td><td style="padding:6px 0; color:#111; text-align:right;">${formatDate(checkIn)}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Check-out</td><td style="padding:6px 0; color:#111; text-align:right;">${formatDate(checkOut)}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Guests</td><td style="padding:6px 0; color:#111; text-align:right;">${guests || 1}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Total</td><td style="padding:6px 0; color:#111; text-align:right;">&#8377;${total}</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

module.exports = { sendResetEmail, sendBookingStatusEmail };
