import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import EmailQueue from '@/lib/models/EmailQueue';
import SentEmail from '@/lib/models/SentEmail';
import { sendEmail, GmailAttachment } from '@/lib/gmail/send';
import { getAttachmentForEmail } from '@/lib/attachments/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Authorization Header (Vercel Cron Key)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn(`[Cron] Unauthorized queue-processing attempt.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Cron] Started queue-processing job...`);
    await connectDB();

    let processedCount = 0;
    const batchLimit = 5; // Process up to 5 emails to stay safely under Vercel serverless execution limits (typically 10-60s)
    const results = [];

    // Process jobs sequentially
    while (processedCount < batchLimit) {
      // Find the oldest QUEUED item
      const emailJob = await EmailQueue.findOne({ status: 'QUEUED' }).sort({ createdAt: 1 });
      if (!emailJob) {
        break; // No more queued jobs
      }

      console.log(`[Cron] Processing job ${emailJob._id}...`);
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
            const fileDoc = await db
              .collection('attachments.files')
              .findOne({ _id: attachmentId });

            if (!fileDoc) {
              throw new Error(`Attachment ${attachmentId} not found in database GridFS files.`);
            }

            attachments.push(await getAttachmentForEmail(fileDoc as any, bucket));
          }
        }

        // Send email via Gmail API
        const { gmailMessageId } = await sendEmail({
          toAddresses: emailJob.to_addresses,
          ccAddresses: emailJob.cc_addresses,
          replyTo: emailJob.reply_to,
          subject: emailJob.subject,
          body: emailJob.body,
          attachments,
        });

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

        results.push({ id: emailJob._id.toString(), status: 'SENT' });
      } catch (err: any) {
        console.error(`[Cron] Error processing job ${emailJob._id}:`, err);
        const failureTime = new Date();
        const failureReason = err.message || String(err);

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

        results.push({ id: emailJob._id.toString(), status: 'FAILED', error: failureReason });
      }

      processedCount++;
    }

    console.log(`[Cron] Completed execution. Processed ${processedCount} jobs.`);
    return NextResponse.json({
      message: 'Queue processing complete',
      processed: processedCount,
      jobs: results,
    });
  } catch (error: any) {
    console.error('[Cron] Unhandled exception in process-queue API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
