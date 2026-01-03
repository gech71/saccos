
// src/lib/email-service.ts
import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  // Check if SMTP is configured
  if (!process.env.SMTP_EMAIL_USER || !process.env.SMTP_EMAIL_PASS) {
    console.error("❌ SMTP not configured: SMTP_EMAIL_USER or SMTP_EMAIL_PASS missing");
    throw new Error("Email service is not configured. Please contact your administrator.");
  }

  // Email Sending with Nodemailer 
  try {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587");
    const secure = process.env.SMTP_SECURE === "true" || false;
    const user = process.env.SMTP_EMAIL_USER;

    // Log configuration (for debugging)
    console.log(`📧 Configuring email transport: Host=${host}, Port=${port}, Secure=${secure}, User=${user}`);

    // Try Gmail SMTP first, with better configuration
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for other ports
      auth: {
        user, 
        pass: process.env.SMTP_EMAIL_PASS, 
      },
      // Add timeout and connection options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      
    });

    // Verify connection before sending
    await transporter.verify();

    const mailOptions = {
      from: `"Nib Sacco" <${process.env.SMTP_EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 12px;">Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          <p style="color: #d32f2f; font-size: 12px; margin-top: 20px;"><strong>This link will expire in 1 hour.</strong></p>
          <p style="color: #666; font-size: 12px;">If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
      `,
      text: `
Password Reset Request

You requested a password reset. Click the link below to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to send email:", error);
    
    // Provide more helpful error messages
    if (error.code === 'EDNS' || error.code === 'ETIMEOUT') {
      throw new Error("Unable to connect to email server. Please check your SMTP configuration and network connection.");
    }
    if (error.code === 'EAUTH') {
      throw new Error("Email authentication failed. Please check your SMTP credentials.");
    }
    if (error.responseCode === 535) {
      throw new Error("Email authentication failed. For Gmail, you may need to use an App Password instead of your regular password.");
    }
    
    throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
  }
}
