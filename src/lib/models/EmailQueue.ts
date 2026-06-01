import mongoose, { Schema, Document, Model } from 'mongoose';

export type QueueStatus = 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface IEmailQueue extends Document {
  _id: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  from_email: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body: string;
  attachment_ids: mongoose.Types.ObjectId[];
  template_id: mongoose.Types.ObjectId | null;
  signature_id: mongoose.Types.ObjectId | null;
  reply_to: string;
  status: QueueStatus;
  failure_reason: string | null;
  gmail_message_id: string | null;
  processing_started_at: Date | null;
  sent_at: Date | null;
  failed_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailQueueSchema = new Schema<IEmailQueue>(
  {
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    from_email: { type: String, required: true, default: 'info@m37labs.com' },
    to_addresses: { type: [String], required: true },
    cc_addresses: { type: [String], default: [] },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    attachment_ids: { type: [Schema.Types.ObjectId], default: [] },
    template_id: { type: Schema.Types.ObjectId, ref: 'Template', default: null },
    signature_id: { type: Schema.Types.ObjectId, ref: 'Signature', default: null },
    reply_to: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'PROCESSING', 'SENT', 'FAILED'],
      default: 'QUEUED',
    },
    failure_reason: { type: String, default: null },
    gmail_message_id: { type: String, default: null },
    processing_started_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
  },
  { timestamps: true }
);

EmailQueueSchema.index({ created_by: 1, status: 1 });
EmailQueueSchema.index({ status: 1, createdAt: 1 });

const EmailQueue: Model<IEmailQueue> =
  mongoose.models.EmailQueue ||
  mongoose.model<IEmailQueue>('EmailQueue', EmailQueueSchema);

export default EmailQueue;
