import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Compute token hash to look up in DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find token and check if it is expired
    const resetTokenDoc = await PasswordResetToken.findOne({
      token_hash: tokenHash,
      expires_at: { $gt: new Date() },
    });

    if (!resetTokenDoc) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token.' },
        { status: 400 }
      );
    }

    // Find the associated user
    const user = await User.findById(resetTokenDoc.user_id);
    if (!user || user.status === 'INACTIVE') {
      return NextResponse.json(
        { error: 'User account is inactive or not found.' },
        { status: 400 }
      );
    }

    if (user.login_method === 'OAUTH') {
      return NextResponse.json(
        { error: 'This user account only supports Google login.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user's password and change login_method to BOTH if it was OAUTH (wait, if it was OAUTH, it's blocked, but if it is BOTH or PASSWORD, keep it)
    user.password_hash = passwordHash;
    await user.save();

    // Clean up reset tokens
    await PasswordResetToken.deleteMany({ user_id: user._id });

    console.log(`Password reset successfully for user ${user.email}`);

    return NextResponse.json({ message: 'Password has been reset successfully.' });
  } catch (error: any) {
    console.error('Error in reset-password API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
