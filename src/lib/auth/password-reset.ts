import crypto from 'crypto';
import nodemailer from 'nodemailer';
import PasswordResetToken from '@/lib/models/PasswordResetToken';

interface ResetEmailOptions {
  userId: string;
  email: string;
  fullName: string;
}

export async function sendPasswordResetEmail({
  userId,
  email,
  fullName,
}: ResetEmailOptions): Promise<{ sent: boolean; resetLink: string }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 3600000);

  await PasswordResetToken.deleteMany({ user_id: userId });
  await PasswordResetToken.create({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'no-reply@m37labs.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP configuration is incomplete. Logged reset link:', resetLink);
    return { sent: false, resetLink };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"M37Labs Portal" <${smtpFrom}>`,
    to: email,
    subject: 'Password Reset Request - M37Labs Portal',
    html: `
      <div style="font-family: 'IBM Plex Sans', -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 6px; background-color: #fff;">
        <h2 style="font-size: 16px; font-weight: 500; color: #111; margin-top: 0; border-bottom: 1px solid #ebebeb; padding-bottom: 12px;">M37Labs Email Portal</h2>
        <p style="font-size: 13px; color: #555; line-height: 1.6;">Hello ${fullName},</p>
        <p style="font-size: 13px; color: #555; line-height: 1.6;">We received a request to reset your password for the M37Labs Email Sending Portal.</p>
        <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 20px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 8px 16px; background-color: #1a1a1a; color: #fff; text-decoration: none; border-radius: 4px; font-size: 12.5px; font-weight: 500;">Reset Password</a>
        </p>
        <p style="font-size: 11px; color: #999; line-height: 1.5;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact an administrator.</p>
        <hr style="border: none; border-top: 1px solid #ebebeb; margin: 20px 0 12px;" />
        <p style="font-size: 10px; color: #999; font-family: monospace;">M37Labs Email Sending Portal</p>
      </div>
    `,
  });

  return { sent: true, resetLink };
}
