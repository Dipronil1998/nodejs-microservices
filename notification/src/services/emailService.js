import transporter from '../config/email.js';

/**
 * Send an email
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} [options.body] - Email body (plain text or HTML)
 * @param {string} [options.text] - Explicit plain text body
 * @param {string} [options.html] - Explicit HTML body
 * @param {string} [options.from] - Custom sender address
 * @param {string|string[]} [options.cc] - Carbon copy recipient(s)
 * @param {string|string[]} [options.bcc] - Blind carbon copy recipient(s)
 * @param {Array} [options.attachments] - Nodemailer attachment objects
 * @returns {Promise<Object>} Result from nodemailer
 */
export const sendMail = async ({
    to,
    subject,
    body,
    text,
    html,
    from,
    cc,
    bcc,
    attachments
}) => {
    const defaultFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@example.com';
    const sender = from || defaultFrom;

    const mailOptions = {
        from: sender,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        ...(cc && { cc: Array.isArray(cc) ? cc.join(', ') : cc }),
        ...(bcc && { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc }),
        ...(attachments && { attachments })
    };

    // Determine content format from body, text, and html
    if (html) {
        mailOptions.html = html;
        if (text) mailOptions.text = text;
        else if (body) mailOptions.text = body;
    } else if (text) {
        mailOptions.text = text;
    } else if (body) {
        // Check if body looks like HTML tags
        const isHtml = /<[a-z][\s\S]*>/i.test(body);
        if (isHtml) {
            mailOptions.html = body;
        } else {
            mailOptions.text = body;
        }
    }

    const info = await transporter.sendMail(mailOptions);
    return info;
};
