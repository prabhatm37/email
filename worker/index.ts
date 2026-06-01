import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';
import connectDB from '../src/lib/db/mongodb';
import EmailQueue from '../src/lib/models/EmailQueue';
import SentEmail from '../src/lib/models/SentEmail';
import { sendEmail, GmailAttachment } from '../src/lib/gmail/send';
import { getAttachmentForEmail } from '../src/lib/attachments/storage';

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

const POLL_INTERVAL = 30000; // 30 seconds

async function processQueue() {
  try {
    console.log(`[${new Date().toISOString()}] Polling queue...`);
    
    // Find oldest QUEUED item
    const emailJob = await EmailQueue.findOne({ status: 'QUEUED' }).sort({ createdAt: 1 });

    if (!emailJob) {
      return;
    }

    console.log(`Found job ${emailJob._id}. Setting status to PROCESSING...`);
    emailJob.status = 'PROCESSING';
    emailJob.processing_started_at = new Date();
    await emailJob.save();

    try {
      // Fetch attachments from GridFS or Supabase Storage
      const attachments: GmailAttachment[] = [];
      if (emailJob.attachment_ids && emailJob.attachment_ids.length > 0) {
        const db = mongoose.connection.db;
        if (!db) {
          throw new Error('MongoDB connection is not ready.');
        }

        const bucket = new mongoose.mongo.GridFSBucket(db, {
          bucketName: 'attachments',
        });

        for (const attachmentId of emailJob.attachment_ids) {
          // Fetch file metadata from the attachments.files collection
          const fileDoc = await db
            .collection('attachments.files')
            .findOne({ _id: attachmentId });

          if (!fileDoc) {
            throw new Error(`Attachment ${attachmentId} not found in database GridFS files.`);
          }

          console.log(`Downloading attachment: ${fileDoc.filename} (${attachmentId})`);
          attachments.push(await getAttachmentForEmail(fileDoc as any, bucket));
        }
      }

      console.log(`Sending email for job ${emailJob._id} via Gmail...`);
      const { gmailMessageId } = await sendEmail({
        toAddresses: emailJob.to_addresses,
        ccAddresses: emailJob.cc_addresses,
        replyTo: emailJob.reply_to,
        subject: emailJob.subject,
        body: emailJob.body,
        attachments,
      });

      console.log(`Email sent. Gmail Message ID: ${gmailMessageId}`);

      // Update queue job status to SENT
      const sentTime = new Date();
      emailJob.status = 'SENT';
      emailJob.gmail_message_id = gmailMessageId;
      emailJob.sent_at = sentTime;
      await emailJob.save();

      // Create/update SentEmail history record
      await SentEmail.findOneAndUpdate(
        { queue_id: emailJob._id },
        {
          queue_id: emailJob._id,
          sent_by: emailJob.created_by,
          from_email: emailJob.from_email,
          to_addresses: emailJob.to_addresses,
          cc_addresses: emailJob.cc_addresses,
          subject: emailJob.subject,
          body: emailJob.body,
          attachment_ids: emailJob.attachment_ids,
          template_id: emailJob.template_id,
          signature_id: emailJob.signature_id,
          reply_to: emailJob.reply_to,
          gmail_message_id: gmailMessageId,
          status: 'SENT',
          sent_at: sentTime,
          failed_at: null,
          failure_reason: null,
        },
        { upsert: true, new: true }
      );
      console.log(`Saved history for job ${emailJob._id}`);

    } catch (sendError: any) {
      console.error(`Error sending email for job ${emailJob._id}:`, sendError);
      
      const failureTime = new Date();
      const failureReason = sendError.message || String(sendError);
      emailJob.status = 'FAILED';
      emailJob.failed_at = failureTime;
      emailJob.failure_reason = failureReason;
      await emailJob.save();

      await SentEmail.findOneAndUpdate(
        { queue_id: emailJob._id },
        {
          queue_id: emailJob._id,
          sent_by: emailJob.created_by,
          from_email: emailJob.from_email,
          to_addresses: emailJob.to_addresses,
          cc_addresses: emailJob.cc_addresses,
          subject: emailJob.subject,
          body: emailJob.body,
          attachment_ids: emailJob.attachment_ids,
          template_id: emailJob.template_id,
          signature_id: emailJob.signature_id,
          reply_to: emailJob.reply_to,
          gmail_message_id: null,
          status: 'FAILED',
          sent_at: null,
          failed_at: failureTime,
          failure_reason: failureReason,
        },
        { upsert: true, new: true }
      );
    }

  } catch (err) {
    console.error('Error in processQueue iteration:', err);
  }
}

async function startWorker() {
  console.log('Starting M37Labs Email Queue Worker...');
  try {
    await connectDB();
    console.log('Worker database connection established.');

    // Run immediately on start, then repeat at intervals
    await processQueue();
    
    setInterval(async () => {
      await processQueue();
    }, POLL_INTERVAL);
  } catch (error) {
    console.error('Failed to start email queue worker:', error);
    process.exit(1);
  }
}

startWorker();
