import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'PRODUCT_MANAGER' | 'SENIOR_PRODUCT_MANAGER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type LoginMethod = 'PASSWORD' | 'OAUTH' | 'BOTH';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  login_method: LoginMethod;
  password_hash: string | null;
  last_login_at: Date | null;
  created_by: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['PRODUCT_MANAGER', 'SENIOR_PRODUCT_MANAGER'],
    },
    status: { type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    login_method: {
      type: String,
      required: true,
      enum: ['PASSWORD', 'OAUTH', 'BOTH'],
      default: 'PASSWORD',
    },
    password_hash: { type: String, default: null },
    last_login_at: { type: Date, default: null },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
