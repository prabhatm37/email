import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import SentEmail from '@/lib/models/SentEmail';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    
    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    await connectDB();

    // Construct query
    const query: any = {};

    if (session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      // Product Managers only see their own sent history
      query.sent_by = session.user.id;
    }

    // Add search conditions if query is provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { subject: searchRegex },
        { body: searchRegex },
        { to_addresses: searchRegex },
        { cc_addresses: searchRegex },
      ];
    }

    // Fetch matching sent emails
    const total = await SentEmail.countDocuments(query);
    const emails = await SentEmail.find(query)
      .populate('sent_by', 'full_name email')
      .sort({ sent_at: -1, failed_at: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      emails,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/emails/sent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
