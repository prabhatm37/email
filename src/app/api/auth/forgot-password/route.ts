import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { sendPasswordResetEmail } from '@/lib/auth/password-reset';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const lowercaseEmail = email.toLowerCase().trim();
    const rateLimit = await checkRateLimit(
      `forgot-password:${getClientIp(req)}:${lowercaseEmail}`,
      5,
      60 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many password reset attempts. Please try again later.' }, { status: 429 });
    }

    const user = await User.findOne({ email: lowercaseEmail });

    // Enforce generic response for security to avoid email enumeration
    const successResponse = NextResponse.json({
      message: 'If a matching active user is found, a password reset link has been sent.',
    });

    if (!user || user.status === 'INACTIVE' || user.login_method === 'OAUTH') {
      // Do not send email, just return success
      return successResponse;
    }

    await sendPasswordResetEmail({
      userId: user._id.toString(),
      email: user.email,
      fullName: user.full_name,
    });
    console.log(`Password reset email sent successfully to ${user.email}`);

    return successResponse;
  } catch (error: any) {
    console.error('Error in forgot-password API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
