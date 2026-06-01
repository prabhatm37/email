import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { sendUserCredentialsEmail } from '@/lib/auth/user-credentials-email';

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const users = await User.find({})
      .select('-password_hash')
      .sort({ createdAt: -1 });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { full_name, email, role, status, login_method, password } = body;

    // Basic Validation
    if (!full_name || !email || !role || !status || !login_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lowercaseEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: lowercaseEmail });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 400 });
    }

    let passwordHash = null;
    if (login_method === 'PASSWORD' || login_method === 'BOTH') {
      if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password, 12);
    }

    const newUser = new User({
      full_name,
      email: lowercaseEmail,
      role,
      status,
      login_method,
      password_hash: passwordHash,
      last_login_at: null,
      created_by: session.user.id,
    });

    await newUser.save();

    let credentialsEmailSent = false;
    try {
      const result = await sendUserCredentialsEmail({
        email: lowercaseEmail,
        fullName: full_name,
        password: login_method === 'PASSWORD' || login_method === 'BOTH' ? password : null,
        loginMethod: login_method,
      });
      credentialsEmailSent = result.sent;
    } catch (mailError) {
      console.error('Failed to send new user credentials email:', mailError);
    }

    // Return created user without password hash
    const userObject = newUser.toObject();
    const userResponse = {
      ...userObject,
      password_hash: undefined,
    };

    return NextResponse.json({ ...userResponse, credentials_email_sent: credentialsEmailSent }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
