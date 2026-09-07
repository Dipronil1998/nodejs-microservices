import { sendMail } from '../services/emailService.js';

// Basic email regex validator
const isValidEmail = (email) => {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const sendEmail = async (req, res) => {
    try {
        const { to, subject, body, text, html, from, cc, bcc, attachments } = req.body;

        // Validate 'to'
        if (!to) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: 'to' field is required."
            });
        }

        const recipients = Array.isArray(to) ? to : [to];
        const invalidRecipients = recipients.filter((email) => !isValidEmail(email));
        if (invalidRecipients.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Validation Error: Invalid recipient email address(es): ${invalidRecipients.join(', ')}`
            });
        }

        // Validate 'subject'
        if (!subject || (typeof subject === 'string' && subject.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: 'subject' field is required."
            });
        }

        // Validate content
        if (!body && !text && !html) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: 'body' (or 'text'/'html') field is required."
            });
        }

        const info = await sendMail({
            to,
            subject,
            body,
            text,
            html,
            from,
            cc,
            bcc,
            attachments
        });

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            data: {
                messageId: info.messageId,
                accepted: info.accepted,
                rejected: info.rejected,
                response: info.response
            }
        });
    } catch (error) {
        console.error('Error in sendEmail controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message || error
        });
    }
};
