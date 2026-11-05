import { formatCents, ORDER_STATUS_LABELS, shortOrderId, type OrderDTO } from '@cart2heavy/shared';
import type { MailMessage } from './mailer';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function layout(
  heading: string,
  intro: string,
  order: OrderDTO,
  appUrl: string,
): { text: string; html: string } {
  const link = `${appUrl}/orders/${order.id}`;
  const address = order.address;
  const addressLines = [
    address.fullName,
    address.line1,
    address.line2,
    `${address.postalCode} ${address.city}`,
    address.country,
  ].filter(Boolean);

  const text = [
    heading,
    '',
    intro,
    '',
    `Order ${shortOrderId(order.id)}`,
    ...order.items.map((i) => `  ${i.quantity} x ${i.name} – ${formatCents(i.lineTotalCents)}`),
    `  Delivery – ${formatCents(order.deliveryCents)}`,
    `  Total – ${formatCents(order.totalCents)}`,
    '',
    'Delivery address:',
    ...addressLines.map((l) => `  ${l}`),
    '',
    `Follow your order: ${link}`,
  ].join('\n');

  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0">${i.quantity} × ${escapeHtml(i.name)}</td>` +
        `<td style="padding:4px 0;text-align:right">${formatCents(i.lineTotalCents)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:24px">
  <div style="background:#fff;border-radius:8px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;color:#52525b">${escapeHtml(intro)}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#71717a">Order ${escapeHtml(shortOrderId(order.id))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
      <tr><td style="padding:4px 0;color:#71717a">Delivery</td><td style="padding:4px 0;text-align:right;color:#71717a">${formatCents(order.deliveryCents)}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #e4e4e7"><strong>Total</strong></td><td style="padding:8px 0;border-top:1px solid #e4e4e7;text-align:right"><strong>${formatCents(order.totalCents)}</strong></td></tr>
    </table>
    <p style="margin:16px 0 4px;font-size:13px;color:#71717a">Delivery address</p>
    <p style="margin:0;font-size:14px">${addressLines.map(escapeHtml).join('<br>')}</p>
    <p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">View your order</a></p>
  </div>
</div></body></html>`;
  return { text, html };
}

export function orderReceivedEmail(order: OrderDTO, appUrl: string): MailMessage {
  const heading = 'Thanks – we received your order';
  const intro = 'Your payment went through. We will confirm your order shortly.';
  return {
    to: order.email,
    subject: `Order ${shortOrderId(order.id)} received`,
    ...layout(heading, intro, order, appUrl),
  };
}

export type StatusEmailKind = 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export function orderStatusEmail(
  order: OrderDTO,
  appUrl: string,
  kind: StatusEmailKind,
): MailMessage {
  const label = ORDER_STATUS_LABELS[kind];
  return {
    to: order.email,
    subject: `Order ${shortOrderId(order.id)}: ${label.label.toLowerCase()}`,
    ...layout(`Your order is ${label.label.toLowerCase()}`, label.description, order, appUrl),
  };
}
