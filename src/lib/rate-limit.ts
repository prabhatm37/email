import mongoose, { Schema, Document, Model } from 'mongoose';

interface IRateLimit extends Document {
  key: string;
  count: number;
  expires_at: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

RateLimitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const expiresAt = new Date(Date.now() + windowMs);
  const existing = await RateLimit.findOne({ key });
  const record =
    !existing || existing.expires_at <= now
      ? await RateLimit.findOneAndUpdate(
          { key },
          { count: 1, expires_at: expiresAt },
          { new: true, upsert: true }
        )
      : await RateLimit.findOneAndUpdate(
          { key },
          { $inc: { count: 1 } },
          { new: true, upsert: true }
        );

  if (record.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: Math.max(0, limit - record.count) };
}
