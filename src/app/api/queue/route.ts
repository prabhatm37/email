import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import EmailQueue from '@/lib/models/EmailQueue';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    await connectDB();

    // Construct query with status filter and role scoping
    const query: any = {};
    
    if (statusFilter) {
      const upperStatus = statusFilter.toUpperCase();
      if (['QUEUED', 'PROCESSING', 'SENT', 'FAILED'].includes(upperStatus)) {
        query.status = upperStatus;
      }
    }

    if (session.user.role !== 'SENIOR_PRODUCT_MANAGER') {
      // Product Managers only see their own queued items
      query.created_by = session.user.id;
    }

    const total = await EmailQueue.countDocuments(query);
    const queueItems = await EmailQueue.find(query)
      .populate('created_by', 'full_name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      items: queueItems,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/queue:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
