import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mockUserVotes, voteMockReport } from '@/lib/mockDb';

export async function GET(request: Request) {
  try {
    // Check if Supabase keys are configured
    const isSupabaseConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

    // ==========================================
    // MOCK DATABASE MODE (Supabase not configured)
    // ==========================================
    if (!isSupabaseConfigured) {
      const votesList = Object.entries(mockUserVotes).map(([report_id, vote]) => ({
        report_id,
        vote,
      }));
      return NextResponse.json({ votes: votesList });
    }

    // ==========================================
    // LIVE DATABASE MODE
    // ==========================================
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ votes: [] });
    }

    const { data, error } = await supabase
      .from('confirmations')
      .select('report_id, vote')
      .eq('user_id', user.id);

    if (error) {
      console.error('Database SELECT error in confirmations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ votes: data || [] });
  } catch (error: any) {
    console.error('API Error in GET /api/confirmations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { report_id, vote } = body;

    // Validation
    if (!report_id || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields: report_id, vote' },
        { status: 400 }
      );
    }

    if (vote !== 'confirm' && vote !== 'dispute') {
      return NextResponse.json(
        { error: "Vote must be either 'confirm' or 'dispute'" },
        { status: 400 }
      );
    }

    // Check if Supabase keys are configured
    const isSupabaseConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

    // ==========================================
    // MOCK DATABASE MODE (Supabase not configured)
    // ==========================================
    if (!isSupabaseConfigured) {
      const updatedReport = voteMockReport(report_id, vote);
      if (!updatedReport) {
        return NextResponse.json({ error: 'Report not found in mock database' }, { status: 404 });
      }
      return NextResponse.json({ success: true, confirmation: { report_id, vote } });
    }

    // ==========================================
    // LIVE DATABASE MODE
    // ==========================================
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. You must be signed in to vote.' }, { status: 401 });
    }

    // Upsert confirmation
    const { data, error } = await supabase
      .from('confirmations')
      .upsert(
        {
          report_id,
          user_id: user.id,
          vote,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'report_id,user_id',
        }
      )
      .select();

    if (error) {
      console.error('Database UPSERT error in confirmations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, confirmation: data?.[0] || null });
  } catch (error: any) {
    console.error('API Error in POST /api/confirmations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
