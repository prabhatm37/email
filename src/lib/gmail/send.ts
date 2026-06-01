import nodemailer from 'nodemailer';
import { google } from 'googleapis';

// Define the attachment format
export interface GmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailOptions {
  toAddresses: string[];
  ccAddresses: string[];
  replyTo: string;
  subject: string;
  body: string;
  attachments?: GmailAttachment[];
}

export async function sendEmail({
  toAddresses,
  ccAddresses,
  replyTo,
  subject,
  body,
  attachments = [],
}: SendEmailOptions): Promise<{ gmailMessageId: string }> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || 'info@m37labs.com';

  // Check if credentials are missing or are the defaults/placeholders from .env.local
  const isPlaceholder = (val?: string) => 
    !val || 
    val.includes('your-gmail-') || 
    val.includes('change-this-') || 
    val.trim() === '';

  if (isPlaceholder(clientId) || isPlaceholder(clientSecret) || isPlaceholder(refreshToken)) {
    throw new Error(
      `Gmail API credentials are not configured or are still placeholders in .env.local. ` +
      `Please configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.`
    );
  }

  // 1. Initialize Google OAuth2 client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Verify which mailbox the refresh token actually authenticates as.
  let authenticatedMailbox: string | undefined;
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    authenticatedMailbox = profile.data.emailAddress?.toLowerCase();
  } catch (error: any) {
    const scopeError =
      error?.code === 403 &&
      (error?.message?.includes('insufficient authentication scopes') ||
        error?.response?.data?.error?.message?.includes('insufficient authentication scopes'));

    if (scopeError) {
      throw new Error(
        'GMAIL_REFRESH_TOKEN does not include a scope that allows Gmail profile lookup. ' +
        'Regenerate the token with one of these scopes in addition to send access: ' +
        'https://www.googleapis.com/auth/gmail.compose, ' +
        'https://www.googleapis.com/auth/gmail.readonly, ' +
        'https://www.googleapis.com/auth/gmail.modify, ' +
        'https://www.googleapis.com/auth/gmail.metadata, or https://mail.google.com/.'
      );
    }

    throw error;
  }

  const configuredSender = senderEmail.toLowerCase();

  if (authenticatedMailbox && authenticatedMailbox !== configuredSender) {
    throw new Error(
      `Gmail OAuth token is authenticated as ${authenticatedMailbox}, but GMAIL_SENDER_EMAIL is ${configuredSender}. ` +
      `Regenerate GMAIL_REFRESH_TOKEN while logged into ${configuredSender}, or configure ${configuredSender} as a valid ` +
      `"Send mail as" alias on ${authenticatedMailbox}.`
    );
  }

  // 2. Build standard MIME message using Nodemailer stream transport
  // This constructs attachments, HTML body, headers, boundaries, etc. automatically
  const tempTransporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
  });

  const mailOptions = {
    from: `M37Labs <${senderEmail}>`,
    to: toAddresses.join(', '),
    cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
    replyTo: replyTo,
    subject: subject,
    html: body,
    attachments: attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  };

  const info = await tempTransporter.sendMail(mailOptions);

  // Read raw email from stream/buffer
  const rawMessageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const message = info.message;
    if (Buffer.isBuffer(message)) {
      resolve(message);
    } else {
      const chunks: Buffer[] = [];
      message.on('data', (chunk: Buffer) => chunks.push(chunk));
      message.on('end', () => resolve(Buffer.concat(chunks)));
      message.on('error', reject);
    }
  });

  // Base64url encode the MIME payload (replace '+' with '-', '/' with '_', and strip '=')
  const base64SafeString = rawMessageBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  console.log(`Sending email from ${senderEmail} to ${toAddresses.join(', ')} via Gmail API...`);

  // 3. Send message via Gmail API
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: base64SafeString,
    },
  });

  const gmailMessageId = response.data.id;
  if (!gmailMessageId) {
    throw new Error('Gmail API delivery failed. No message ID returned.');
  }

  console.log(`Email sent successfully via Gmail API! Message ID: ${gmailMessageId}`);

  return { gmailMessageId };
}
