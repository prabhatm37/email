import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPasswordResetToken extends Document {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  token_hash: string;
  expires_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete document after it expires (TTL index)
PasswordResetTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
PasswordResetTokenSchema.index({ token_hash: 1 });

const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);

export default PasswordResetToken;
