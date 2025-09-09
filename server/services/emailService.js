// server/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: parseInt(process.env.EMAIL_PORT, 10) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOtpEmail = async (to, otp) => {
    const mailOptions = {
        from: `"iMentor AI" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Your iMentor Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2 style="color: #3b82f6;">Welcome to iMentor!</h2>
                <p>Thank you for signing up. Please use the following One-Time Password (OTP) to complete your registration:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1e293b; background-color: #f1f5f9; padding: 10px 20px; border-radius: 8px; display: inline-block;">
                    ${otp}
                </p>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
                <br>
                <p>Best regards,</p>
                <p>The iMentor Team</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] OTP email sent successfully to ${to}`);
    } catch (error) {
        console.error(`[EmailService] Error sending OTP email to ${to}:`, error);
        throw new Error('Failed to send verification email.');
    }
};

module.exports = { sendOtpEmail };