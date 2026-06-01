import nodemailer from 'nodemailer';

interface SendUserCredentialsEmailOptions {
  email: string;
  fullName: string;
  password?: string | null;
  loginMethod: 'PASSWORD' | 'OAUTH' | 'BOTH';
}

export async function sendUserCredentialsEmail({
  email,
  fullName,
  password,
  loginMethod,
}: SendUserCredentialsEmailOptions): Promise<{ sent: boolean }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'no-reply@m37labs.com';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(`SMTP configuration is incomplete. Could not send account email to ${email}.`);
    return { sent: false };
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

  const passwordSection =
    loginMethod === 'PASSWORD' || loginMethod === 'BOTH'
      ? `
        <div style="margin: 16px 0; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Temporary Credentials</p>
          <p style="margin: 0 0 6px; font-size: 14px; color: #111827;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0; font-size: 14px; color: #111827;"><strong>Password:</strong> ${password}</p>
        </div>
      `
      : `
        <div style="margin: 16px 0; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Account Email</p>
          <p style="margin: 0; font-size: 14px; color: #111827;"><strong>Email:</strong> ${email}</p>
        </div>
      `;

  const loginMethodCopy =
    loginMethod === 'OAUTH'
      ? 'Sign in with Google using this email address.'
      : loginMethod === 'BOTH'
        ? 'You can sign in with the password below or with Google OAuth using this email address.'
        : 'Use the password below to sign in.';

  await transporter.sendMail({
    from: `"M37Labs Portal" <${smtpFrom}>`,
    to: email,
    subject: 'Your M37Labs Portal Account',
    html: `
      <div style="font-family: 'IBM Plex Sans', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111; margin-top: 0; border-bottom: 1px solid #ebebeb; padding-bottom: 12px;">M37Labs Email Portal</h2>
        <p style="font-size: 13px; color: #555; line-height: 1.6;">Hello ${fullName},</p>
        <p style="font-size: 13px; color: #555; line-height: 1.6;">A new account has been created for you on the M37Labs Email Portal.</p>
        ${passwordSection}
        <p style="font-size: 13px; color: #555; line-height: 1.6;">${loginMethodCopy}</p>
        <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 20px 0;">
          <a href="${appUrl}/login" style="display: inline-block; padding: 8px 16px; background-color: #1a1a1a; color: #fff; text-decoration: none; border-radius: 4px; font-size: 12.5px; font-weight: 500;">Open Portal</a>
        </p>
        <p style="font-size: 11px; color: #999; line-height: 1.5;">For security, change your password after your first sign-in if you received a password-based account.</p>
        <hr style="border: none; border-top: 1px solid #ebebeb; margin: 20px 0 12px;" />
        <p style="font-size: 10px; color: #999; font-family: monospace;">M37Labs Email Sending Portal</p>
      </div>
    `,
  });

  return { sent: true };
}
