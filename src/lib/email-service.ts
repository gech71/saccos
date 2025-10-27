// src/lib/email-service.ts
import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  
  // Email Sending with Nodemailer 
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL_USER, 
        pass: process.env.SMTP_EMAIL_PASS, 
      },
    });

    const mailOptions = {
      from: `"My App" <${process.env.SMTP_EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password",
      html: `
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
  }

  // Simulate a network request (keep your original delay)
  await new Promise(resolve => setTimeout(resolve, 500));

  return { success: true };
}
