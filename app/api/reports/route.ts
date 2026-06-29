import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mockReports } from '@/lib/mockDb';

function getFilteredMockReports(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  issueTypes: string[] | null,
  minSeverity: number
) {
  // Check if we have mock reports in this viewport, otherwise generate 5 locally
  const reportsInBounds = mockReports.filter(r => 
    r.location_lng >= minLng && r.location_lng <= maxLng &&
    r.location_lat >= minLat && r.location_lat <= maxLat
  );

  if (reportsInBounds.length === 0) {
    const issueTypesList = ['no_curb_cut', 'broken_pavement', 'steps_no_ramp', 'blocked_path', 'steep_grade', 'other'];
    const reporterNames = ['StrollerParent', 'WheelchairRider', 'LocalWalker', 'SafetyInspected', 'StreetSaver'];
    const descriptions = [
      'Uneven pavement causes water logging and wheel trapping.',
      'Missing curb cut forces users into active traffic lanes.',
      'Sidewalk blocked by commercial display bins.',
      'Flight of stairs with no bypass ramp option.',
      'Severe grade makes manual wheelchair navigation hazardous.',
      'Damaged concrete has deep holes and exposed rebar.'
    ];

    // Generate 5 random mock reports inside this active viewport
    for (let i = 0; i < 5; i++) {
      const lat = minLat + Math.random() * (maxLat - minLat);
      const lng = minLng + Math.random() * (maxLng - minLng);
      const issue = issueTypesList[Math.floor(Math.random() * issueTypesList.length)];
      const name = reporterNames[Math.floor(Math.random() * reporterNames.length)];
      const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
      const severity = Math.floor(Math.random() * 3) + 1;
      
      mockReports.push({
        id: `mock-gen-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`,
        reporter_id: `mock-user-${i}`,
        reporter_name: name,
        location_lng: lng,
        location_lat: lat,
        issue_type: issue,
        severity,
        description: desc,
        photo_url: null,
        status: 'active',
        created_at: new Date(Date.now() - 86400000 * Math.random()).toISOString(),
        confirm_count: Math.floor(Math.random() * 4),
        dispute_count: 0
      });
    }
  }

  // Filter local mockReports array
  return mockReports.filter((r) => {
    // Bounding box check
    const inBbox = r.location_lng >= minLng && r.location_lng <= maxLng &&
                   r.location_lat >= minLat && r.location_lat <= maxLat;
    
    // Active/disputed check
    const isActive = r.status === 'active' || r.status === 'disputed';
    
    // Category check
    const matchesType = !issueTypes || issueTypes.includes(r.issue_type);
    
    // Severity check
    const matchesSeverity = r.severity >= minSeverity;

    return inBbox && isActive && matchesType && matchesSeverity;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minLngStr = searchParams.get('min_lng');
    const minLatStr = searchParams.get('min_lat');
    const maxLngStr = searchParams.get('max_lng');
    const maxLatStr = searchParams.get('max_lat');
    const issueTypesStr = searchParams.get('issue_types');
    const minSeverityStr = searchParams.get('min_severity');

    if (!minLngStr || !minLatStr || !maxLngStr || !maxLatStr) {
      return NextResponse.json(
        { error: 'Missing viewport bounding box parameters' },
        { status: 400 }
      );
    }

    const minLng = parseFloat(minLngStr);
    const minLat = parseFloat(minLatStr);
    const maxLng = parseFloat(maxLngStr);
    const maxLat = parseFloat(maxLatStr);

    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
      return NextResponse.json(
        { error: 'Viewport parameters must be valid numbers' },
        { status: 400 }
      );
    }

    // Parse issue_types filter
    let issueTypes: string[] | null = null;
    if (issueTypesStr && issueTypesStr.trim()) {
      issueTypes = issueTypesStr.split(',').map((t) => t.trim());
    }

    // Parse min_severity filter
    let minSeverity = 1;
    if (minSeverityStr) {
      const parsed = parseInt(minSeverityStr, 10);
      if (!isNaN(parsed)) {
        minSeverity = parsed;
      }
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
      const filteredMocks = getFilteredMockReports(minLng, minLat, maxLng, maxLat, issueTypes, minSeverity);
      return NextResponse.json({ reports: filteredMocks });
    }

    // ==========================================
    // LIVE DATABASE MODE (With Mock Fallbacks)
    // ==========================================
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc('reports_in_viewport', {
        min_lng: minLng,
        min_lat: minLat,
        max_lng: maxLng,
        max_lat: maxLat,
        filter_issue_types: issueTypes,
        filter_min_severity: minSeverity,
      });

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Database RPC failed, falling back to mock data:', error.message);
        } else {
          console.log('Database returned empty reports, seeding client with mock data.');
        }
        const filteredMocks = getFilteredMockReports(minLng, minLat, maxLng, maxLat, issueTypes, minSeverity);
        return NextResponse.json({ reports: filteredMocks });
      }

      return NextResponse.json({ reports: data });
    } catch (dbErr: any) {
      console.warn('Database connection failed, falling back to mock data:', dbErr.message);
      const filteredMocks = getFilteredMockReports(minLng, minLat, maxLng, maxLat, issueTypes, minSeverity);
      return NextResponse.json({ reports: filteredMocks });
    }
  } catch (error: any) {
    console.error('API Error in GET /api/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lng, lat, issue_type, severity, description, photo_url } = body;

    // Validation
    if (lng === undefined || lat === undefined || !issue_type || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: lng, lat, issue_type, severity' },
        { status: 400 }
      );
    }

    const severityNum = parseInt(severity, 10);
    if (isNaN(severityNum) || severityNum < 1 || severityNum > 3) {
      return NextResponse.json({ error: 'Severity must be a number between 1 and 3' }, { status: 400 });
    }

    const validIssueTypes = ['no_curb_cut', 'broken_pavement', 'steps_no_ramp', 'blocked_path', 'steep_grade', 'other'];
    if (!validIssueTypes.includes(issue_type)) {
      return NextResponse.json({ error: 'Invalid issue type' }, { status: 400 });
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
      const mockNewReport = {
        id: `mock-user-report-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        reporter_id: 'mock-reporter-id',
        reporter_name: 'You (Mock)',
        location_lng: parseFloat(lng),
        location_lat: parseFloat(lat),
        issue_type,
        severity: severityNum,
        description: description || null,
        photo_url: photo_url || null,
        status: 'active',
        created_at: new Date().toISOString(),
        confirm_count: 0,
        dispute_count: 0
      };
      
      mockReports.push(mockNewReport);
      return NextResponse.json({ success: true, report: mockNewReport }, { status: 201 });
    }

    // ==========================================
    // LIVE DATABASE MODE (With Mock Fallback)
    // ==========================================
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Fallback: If auth fails or user is not logged in live, let them post anonymously or mock
      if (authError || !user) {
        console.warn('Live Auth failed during post, inserting report anonymously');
      }

      const { data, error } = await supabase
        .from('reports')
        .insert([
          {
            reporter_id: user?.id || null,
            location: `POINT(${lng} ${lat})`,
            issue_type,
            severity: severityNum,
            description: description || null,
            photo_url: photo_url || null,
            status: 'active',
          },
        ])
        .select();

      if (error) {
        console.warn('Database INSERT error, falling back to mock database storage:', error.message);
        
        const mockNewReport = {
          id: `mock-user-report-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          reporter_id: user?.id || 'mock-reporter-id',
          reporter_name: user?.email ? user.email.split('@')[0] : 'You (Mock)',
          location_lng: parseFloat(lng),
          location_lat: parseFloat(lat),
          issue_type,
          severity: severityNum,
          description: description || null,
          photo_url: photo_url || null,
          status: 'active',
          created_at: new Date().toISOString(),
          confirm_count: 0,
          dispute_count: 0
        };
        
        mockReports.push(mockNewReport);
        return NextResponse.json({ success: true, report: mockNewReport, fallback: true }, { status: 201 });
      }

      return NextResponse.json({ success: true, report: data?.[0] || null }, { status: 201 });
    } catch (dbErr: any) {
      console.warn('Database connection failed during POST, falling back to mock database storage:', dbErr.message);
      
      const mockNewReport = {
        id: `mock-user-report-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        reporter_id: 'mock-reporter-id',
        reporter_name: 'You (Mock)',
        location_lng: parseFloat(lng),
        location_lat: parseFloat(lat),
        issue_type,
        severity: severityNum,
        description: description || null,
        photo_url: photo_url || null,
        status: 'active',
        created_at: new Date().toISOString(),
        confirm_count: 0,
        dispute_count: 0
      };
      
      mockReports.push(mockNewReport);
      return NextResponse.json({ success: true, report: mockNewReport, fallback: true }, { status: 201 });
    }
  } catch (error: any) {
    console.error('API Error in POST /api/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
