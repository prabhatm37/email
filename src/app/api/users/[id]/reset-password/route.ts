import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { sendPasswordResetEmail } from '@/lib/auth/password-reset';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const session = await auth();
    if (!session || session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(
      `spm-reset:${session.user.id || getClientIp(req)}`,
      20,
      60 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many password reset attempts. Please try again later.' }, { status: 429 });
    }

    const { id } = await ctx.params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Cannot reset password for an inactive user.' }, { status: 400 });
    }

    if (user.login_method === 'OAUTH') {
      return NextResponse.json(
        { error: 'Cannot reset password for an OAuth-only user. Change login method to PASSWORD or BOTH first.' },
        { status: 400 }
      );
    }

    await sendPasswordResetEmail({
      userId: user._id.toString(),
      email: user.email,
      fullName: user.full_name,
    });

    return NextResponse.json({ message: 'Password reset link has been sent.' });
  } catch (error: any) {
    console.error('Error in POST /api/users/[id]/reset-password:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
