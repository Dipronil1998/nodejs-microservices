/**
 * Generate formatted HTML for Order Confirmation Email
 * @param {Object} order - Order document
 * @param {string} [userName] - Customer name
 * @returns {string} HTML string
 */
export const generateOrderEmailHtml = (order, userName = "Customer") => {
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
            <br/><span style="color: #777; font-size: 12px;">Qty: ${item.quantity}</span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            ₹${item.price}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            ₹${item.subtotal}
          </td>
        </tr>`
    )
    .join("");

  const address = order.shippingAddress || {};

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2e7d32; margin-top: 0;">Order Confirmation</h2>
      <p>Hello <strong>${address.fullName || userName}</strong>,</p>
      <p>Thank you for your order! We have received your order <strong>#${order.orderNumber}</strong> and it is now being processed.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0;">Order Summary:</h4>
        <p style="margin: 4px 0;"><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p style="margin: 4px 0;"><strong>Order Status:</strong> ${order.orderStatus}</p>
        <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${order.payment?.method || 'COD'}</p>
        <p style="margin: 4px 0;"><strong>Payment Status:</strong> ${order.payment?.status || 'PENDING'}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: right;">Price</th>
            <th style="padding: 10px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 8px; text-align: right;"><strong>Items Total:</strong></td>
            <td style="padding: 8px; text-align: right;">₹${order.pricing?.itemsTotal || 0}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px; text-align: right;"><strong>Shipping Fee:</strong></td>
            <td style="padding: 8px; text-align: right;">₹${order.pricing?.shippingFee || 0}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px; text-align: right;"><strong>Tax:</strong></td>
            <td style="padding: 8px; text-align: right;">₹${order.pricing?.tax || 0}</td>
          </tr>
          ${order.pricing?.discount > 0 ? `
          <tr>
            <td colspan="2" style="padding: 8px; text-align: right; color: #2e7d32;"><strong>Discount:</strong></td>
            <td style="padding: 8px; text-align: right; color: #2e7d32;">-₹${order.pricing.discount}</td>
          </tr>` : ''}
          <tr style="font-size: 16px;">
            <td colspan="2" style="padding: 10px; text-align: right; border-top: 2px solid #333;"><strong>Total Amount:</strong></td>
            <td style="padding: 10px; text-align: right; border-top: 2px solid #333;"><strong>₹${order.pricing?.totalAmount || 0}</strong></td>
          </tr>
        </tfoot>
      </table>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0;">Shipping Address:</h4>
        <p style="margin: 2px 0;">${address.fullName || ''}</p>
        <p style="margin: 2px 0;">${address.street || ''}${address.landmark ? ', ' + address.landmark : ''}</p>
        <p style="margin: 2px 0;">${address.city || ''}, ${address.state || ''} - ${address.postalCode || ''}</p>
        <p style="margin: 2px 0;">${address.country || 'India'}</p>
        <p style="margin: 2px 0;"><strong>Phone:</strong> ${address.phone || ''}</p>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
        If you have any questions about your order, please contact customer support.
      </p>
    </div>
  `;
};

export default generateOrderEmailHtml;
