// src/lib/email-service.ts
import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  // This is a placeholder. In a real app, you would use a library like `nodemailer`
  // or an SDK for your email service.

  // --- Logging (keep everything you had before) ---
  console.log('--- SIMULATING PASSWORD RESET EMAIL ---');
  console.log(`To: ${email}`);
  console.log('Subject: Reset Your Password');
  console.log('Body:');
  console.log('You requested a password reset. Click the link below to set a new password:');
  console.log(resetUrl);
  console.log('This link will expire in 1 hour.');
  console.log('If you did not request this, please ignore this email.');
  console.log('--------------------------------------');

  // --- Real Email Sending with Nodemailer ---
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Gmail account
        pass: process.env.EMAIL_PASS, // Gmail app password
      },
    });

    const mailOptions = {
      from: `"My App" <${process.env.EMAIL_USER}>`,
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
    console.log("✅ Email sent successfully.");
  } catch (error) {
    console.error("❌ Failed to send email:", error);
  }

  // Simulate a network request (keep your original delay)
  await new Promise(resolve => setTimeout(resolve, 500));

  return { success: true };
}
