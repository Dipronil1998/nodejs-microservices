import nodemailer from 'nodemailer';

export const getTransporterConfig = () => {
    const isSecure = process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465';

    return {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: isSecure,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    };
};

export const createEmailTransporter = () => {
    const config = getTransporterConfig();
    return nodemailer.createTransport(config);
};

const transporter = createEmailTransporter();

export default transporter;
