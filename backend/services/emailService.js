const dotenv = require('dotenv');
const { Resend } = require('resend');
const db = require('../database');

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_FROM = process.env.EMAIL_FROM || 'FOSOGO Closet <onboarding@resend.dev>';
const DELIVERY_ESTIMATE = process.env.DELIVERY_ESTIMATE || 'Estimated delivery is within 3-5 business days after payment confirmation.';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
  }).format(Number(amount || 0));
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Accra',
  }).format(date);
}

function formatAddress(shippingAddress) {
  const parts = [
    shippingAddress?.name,
    shippingAddress?.phone,
    shippingAddress?.address,
    shippingAddress?.city,
  ].filter(Boolean);

  return parts.map(escapeHtml).join('<br />');
}

function renderItemsRows(items, currency) {
  return items.map((item) => {
    const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);
    const size = item.size ? ` <span style="color:#6b7280;">(Size: ${escapeHtml(item.size)})</span>` : '';

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(item.product_name || 'Product')}</strong>${size}
        </td>
        <td align="center" style="padding:12px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.quantity)}</td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #e5e7eb;">${formatCurrency(lineTotal, currency)}</td>
      </tr>
    `;
  }).join('');
}

function baseTemplate({ preheader, title, intro, details, items, total, currency, footer }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:24px 28px;">
                <div style="font-size:14px;letter-spacing:0;text-transform:uppercase;color:#d1d5db;">FOSOGO Closet</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#374151;">${escapeHtml(intro)}</p>
                ${details}
                <h2 style="margin:28px 0 10px;font-size:18px;">Order summary</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:10px 0;border-bottom:2px solid #111827;">Product</th>
                      <th align="center" style="padding:10px 0;border-bottom:2px solid #111827;">Qty</th>
                      <th align="right" style="padding:10px 0;border-bottom:2px solid #111827;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${renderItemsRows(items, currency)}</tbody>
                </table>
                <p style="margin:18px 0 0;text-align:right;font-size:18px;font-weight:700;">Total: ${formatCurrency(total, currency)}</p>
                <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function adminOrderTemplate(order, items, shippingAddress) {
  const details = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px 16px;">
      <tr><td style="padding:10px 0;color:#6b7280;">Order ID</td><td align="right" style="padding:10px 0;font-weight:700;">${escapeHtml(order.order_number || order.id)}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Customer</td><td align="right" style="padding:10px 0;">${escapeHtml(shippingAddress.name || 'Customer')}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Customer email</td><td align="right" style="padding:10px 0;">${escapeHtml(order.customer_email || 'Not provided')}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Order date</td><td align="right" style="padding:10px 0;">${escapeHtml(formatDateTime(order.created_at))}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;vertical-align:top;">Shipping address</td><td align="right" style="padding:10px 0;">${formatAddress(shippingAddress)}</td></tr>
    </table>
  `;

  return baseTemplate({
    preheader: `New order ${order.order_number || order.id} requires review.`,
    title: 'Paid Order Received',
    intro: 'A customer has completed payment successfully. Review the details below and prepare fulfillment.',
    details,
    items,
    total: order.total,
    currency: order.currency,
    footer: 'This notification was generated automatically after Paystack verified the payment successfully.',
  });
}

function customerOrderTemplate(order, items) {
  const details = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px 16px;">
      <tr><td style="padding:10px 0;color:#6b7280;">Order ID</td><td align="right" style="padding:10px 0;font-weight:700;">${escapeHtml(order.order_number || order.id)}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Order date</td><td align="right" style="padding:10px 0;">${escapeHtml(formatDateTime(order.created_at))}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;">Estimated delivery</td><td align="right" style="padding:10px 0;">3-5 business days</td></tr>
    </table>
  `;

  return baseTemplate({
    preheader: `Thanks for your order ${order.order_number || order.id}.`,
    title: 'Thank You For Your Order',
    intro: 'Thank you for shopping with FOSOGO Closet. Your payment has been confirmed and fulfillment will begin shortly.',
    details,
    items,
    total: order.total,
    currency: order.currency,
    footer: DELIVERY_ESTIMATE,
  });
}

async function sendTrackedEmail({ orderId, type, recipient, subject, html }) {
  const notification = db.createEmailNotificationIfMissing(orderId, type, recipient);
  if (!notification.created) {
    console.log(`Skipping duplicate ${type} email for order ${orderId}; notification already exists.`);
    return;
  }

  if (!resend) {
    const message = 'RESEND_API_KEY is not configured.';
    db.markEmailNotificationFailed(notification.id, message);
    console.error(`Email notification failed for order ${orderId}: ${message}`);
    return;
  }

  try {
    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipient,
      subject,
      html,
    });
    const emailId = response?.data?.id || response?.id || null;
    db.markEmailNotificationSent(notification.id, emailId);
  } catch (error) {
    db.markEmailNotificationFailed(notification.id, error.message);
    console.error(`Failed to send ${type} email for order ${orderId}:`, error);
  }
}

async function sendOrderNotificationEmails(order, items, shippingAddress) {
  if (!ADMIN_EMAIL) {
    console.error(`Admin email notification skipped for order ${order.id}: ADMIN_EMAIL is not configured.`);
  } else {
    await sendTrackedEmail({
      orderId: order.id,
      type: 'admin_order_notification',
      recipient: ADMIN_EMAIL,
      subject: `New order ${order.order_number || order.id}`,
      html: adminOrderTemplate(order, items, shippingAddress),
    });
  }

  if (!order.customer_email) {
    console.error(`Customer confirmation skipped for order ${order.id}: customer email is missing.`);
    return;
  }

  await sendTrackedEmail({
    orderId: order.id,
    type: 'customer_order_confirmation',
    recipient: order.customer_email,
    subject: `Your FOSOGO Closet order ${order.order_number || order.id}`,
    html: customerOrderTemplate(order, items),
  });
}

module.exports = {
  sendOrderNotificationEmails,
};
