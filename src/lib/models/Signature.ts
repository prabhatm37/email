import mongoose, { Schema, Document, Model } from 'mongoose';

export type SignatureStatus = 'ACTIVE' | 'INACTIVE';
export type SignatureVisibility = 'PERSONAL';

export interface ISignature extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  body: string; // HTML signature content
  visibility: SignatureVisibility;
  is_default: boolean;
  status: SignatureStatus;
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SignatureSchema = new Schema<ISignature>(
  {
    name: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    visibility: { type: String, required: true, enum: ['PERSONAL'], default: 'PERSONAL' },
    is_default: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes for querying signatures
SignatureSchema.index({ created_by: 1, status: 1 });
SignatureSchema.index({ created_by: 1, is_default: 1 });

const Signature: Model<ISignature> =
  mongoose.models.Signature || mongoose.model<ISignature>('Signature', SignatureSchema);

export default Signature;
