// Server-side shared in-memory mock database (active when Supabase is not configured)
export interface MockReport {
  id: string;
  reporter_id: string;
  reporter_name?: string;
  location_lng: number;
  location_lat: number;
  issue_type: string;
  severity: number;
  description: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  confirm_count: number;
  dispute_count: number;
}

export const mockReports: MockReport[] = [
  {
    id: 'mock-1',
    reporter_id: 'mock-user-1',
    reporter_name: 'StrollerMom',
    location_lng: -74.0080,
    location_lat: 40.7140,
    issue_type: 'broken_pavement',
    severity: 2,
    description: 'Very deep cracks in the asphalt sidewalk. Impossible for stroller wheels.',
    photo_url: null,
    status: 'active',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    confirm_count: 2,
    dispute_count: 0
  },
  {
    id: 'mock-2',
    reporter_id: 'mock-user-2',
    reporter_name: 'WheelchairWayfarer',
    location_lng: -74.0050,
    location_lat: 40.7110,
    issue_type: 'no_curb_cut',
    severity: 3,
    description: 'Missing curb ramp at the crossing corner. Had to roll in the street.',
    photo_url: null,
    status: 'active',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    confirm_count: 4,
    dispute_count: 1
  }
];

// Stores the mock votes in the format { [report_id]: 'confirm' | 'dispute' }
export let mockUserVotes: Record<string, 'confirm' | 'dispute'> = {};

// Helper to update a mock report's voting counts and status trigger
export function voteMockReport(reportId: string, voteType: 'confirm' | 'dispute') {
  const report = mockReports.find(r => r.id === reportId);
  if (!report) return null;

  const previousVote = mockUserVotes[reportId];

  // If they already voted this, return early
  if (previousVote === voteType) return report;

  // Subtract previous vote
  if (previousVote === 'confirm') report.confirm_count = Math.max(0, report.confirm_count - 1);
  if (previousVote === 'dispute') report.dispute_count = Math.max(0, report.dispute_count - 1);

  // Add new vote
  if (voteType === 'confirm') report.confirm_count = (report.confirm_count || 0) + 1;
  if (voteType === 'dispute') report.dispute_count = (report.dispute_count || 0) + 1;

  // Save new vote
  mockUserVotes[reportId] = voteType;

  // Trigger auto-dispute status: 3+ disputes and <= 1 confirms
  if (report.dispute_count >= 3 && report.confirm_count <= 1) {
    report.status = 'disputed';
  } else {
    report.status = 'active';
  }

  return report;
}
