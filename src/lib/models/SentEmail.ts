import mongoose, { Schema, Document, Model } from 'mongoose';

export type SentEmailStatus = 'SENT' | 'FAILED';

export interface ISentEmail extends Document {
  _id: mongoose.Types.ObjectId;
  queue_id: mongoose.Types.ObjectId | null;
  sent_by: mongoose.Types.ObjectId;
  from_email: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body: string;
  attachment_ids: mongoose.Types.ObjectId[];
  template_id: mongoose.Types.ObjectId | null;
  signature_id: mongoose.Types.ObjectId | null;
  reply_to: string;
  gmail_message_id: string | null;
  status: SentEmailStatus;
  sent_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SentEmailSchema = new Schema<ISentEmail>(
  {
    queue_id: { type: Schema.Types.ObjectId, ref: 'EmailQueue', default: null },
    sent_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    from_email: { type: String, required: true, default: 'info@m37labs.com' },
    to_addresses: { type: [String], required: true },
    cc_addresses: { type: [String], default: [] },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    attachment_ids: { type: [Schema.Types.ObjectId], default: [] },
    template_id: { type: Schema.Types.ObjectId, ref: 'Template', default: null },
    signature_id: { type: Schema.Types.ObjectId, ref: 'Signature', default: null },
    reply_to: { type: String, required: true },
    gmail_message_id: { type: String, default: null },
    status: { type: String, required: true, enum: ['SENT', 'FAILED'], default: 'SENT' },
    sent_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
    failure_reason: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes for searching sent emails
SentEmailSchema.index({ sent_by: 1, sent_at: -1 });
SentEmailSchema.index({ sent_at: -1 });
SentEmailSchema.index({ queue_id: 1 }, { unique: true, sparse: true });

const SentEmail: Model<ISentEmail> =
  mongoose.models.SentEmail || mongoose.model<ISentEmail>('SentEmail', SentEmailSchema);

export default SentEmail;
