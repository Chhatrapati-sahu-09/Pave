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
    id: 'roadwork-1',
    reporter_id: 'mock-user-1',
    reporter_name: 'BhilaiNavigator',
    location_lng: 81.276708,
    location_lat: 21.167617,
    issue_type: 'blocked_path',
    severity: 3,
    description: 'Active road construction blocking the entire pedestrian path. Sidewalk completely torn up and blocked by warning signs.',
    photo_url: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=600',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    confirm_count: 5,
    dispute_count: 0
  },
  {
    id: 'roadwork-2',
    reporter_id: 'mock-user-2',
    reporter_name: 'LocalWalker',
    location_lng: 81.294648,
    location_lat: 21.173613,
    issue_type: 'broken_pavement',
    severity: 2,
    description: 'Loose gravel, heavy debris, and deep pavement cracks on the walkway due to nearby road laying work.',
    photo_url: 'https://images.unsplash.com/photo-1508847154043-be12a62861c1?auto=format&fit=crop&q=80&w=600',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
    confirm_count: 3,
    dispute_count: 0
  },
  {
    id: 'roadwork-3',
    reporter_id: 'mock-user-3',
    reporter_name: 'Rider81',
    location_lng: 81.298695,
    location_lat: 21.179395,
    issue_type: 'blocked_path',
    severity: 3,
    description: 'Heavy machinery and safety barriers completely blocking the crossing ramp. Wheelchairs and strollers forced into main road.',
    photo_url: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=600',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    confirm_count: 8,
    dispute_count: 0
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
