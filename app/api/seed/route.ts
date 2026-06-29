import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const isSupabaseConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase is not configured yet in .env.local' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Seed mock reports around Raipur/Bhilai region and New York City
    const mockReportsToSeed = [
      {
        reporter_id: null,
        location: 'POINT(81.2980 21.1740)',
        issue_type: 'broken_pavement',
        severity: 2,
        description: 'Large cracks in concrete path near the park entrance.',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.2850 21.1680)',
        issue_type: 'no_curb_cut',
        severity: 3,
        description: 'Missing curb cut on the pedestrian crossing.',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.3090 21.1820)',
        issue_type: 'blocked_path',
        severity: 1,
        description: 'Street vendor structures blocking the sidewalk.',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(-74.0080 40.7140)',
        issue_type: 'steps_no_ramp',
        severity: 3,
        description: 'Steps at subway entrance with no wheelchair ramp.',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(-74.0050 40.7110)',
        issue_type: 'blocked_path',
        severity: 2,
        description: 'Construction scaffolding blocking path.',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.271717 21.167007)',
        issue_type: 'blocked_path',
        severity: 2,
        description: 'road construction is going on',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.284935 21.169484)',
        issue_type: 'blocked_path',
        severity: 2,
        description: 'road construction is going on',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.298573 21.179979)',
        issue_type: 'blocked_path',
        severity: 2,
        description: 'road construction is going on',
        photo_url: null,
        status: 'active'
      },
      {
        reporter_id: null,
        location: 'POINT(81.315321 21.178532)',
        issue_type: 'broken_pavement',
        severity: 2,
        description: 'Deep cracks and loose concrete chunks make navigation difficult.',
        photo_url: '/demo-sidewalk.png',
        status: 'active'
      }
    ];

    const { data, error } = await supabase
      .from('reports')
      .insert(mockReportsToSeed)
      .select();

    if (error) {
      return NextResponse.json(
        { 
          error: 'Database seeding failed',
          message: error.message,
          hint: 'Make sure you have executed the migration script (0001_init.sql) in your Supabase SQL Editor first!'
        }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully seeded 5 reports into your live Supabase database!',
      seededReports: data
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
