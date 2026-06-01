import mongoose, { Schema, Document, Model } from 'mongoose';

export type TemplateStatus = 'ACTIVE' | 'INACTIVE';
export type TemplateVisibility = 'PERSONAL'; // Global will be added in Phase 2

export interface ITemplate extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body: string;
  status: TemplateStatus;
  visibility: TemplateVisibility;
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true, trim: true },
    to_addresses: { type: [String], default: [] },
    cc_addresses: { type: [String], default: [] },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    status: { type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    visibility: { type: String, required: true, enum: ['PERSONAL'], default: 'PERSONAL' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Index for listing templates of a user
TemplateSchema.index({ created_by: 1, status: 1 });

const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

export default Template;
