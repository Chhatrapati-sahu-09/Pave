import { Ban, CornerDownLeft, Layers, TrendingUp, AlertTriangle, Construction } from 'lucide-react';

export const ISSUE_TYPES = {
  no_curb_cut: {
    label: 'Missing Curb Cut',
    description: 'No wheel-ramp or dropped curb at crossing',
    icon: CornerDownLeft,
    bgColor: '#FF5500', // orange
  },
  broken_pavement: {
    label: 'Broken Pavement',
    description: 'Cracked, uneven, or root-lifted sidewalk',
    icon: Construction,
    bgColor: '#0047FF', // electric blue
  },
  steps_no_ramp: {
    label: 'Steps / No Ramp',
    description: 'Steps or stairs obstructing wheelchair/stroller passage',
    icon: Layers,
    bgColor: '#FF3399', // hot pink
  },
  blocked_path: {
    label: 'Blocked Path',
    description: 'Construction, debris, garbage bins, or parked vehicle',
    icon: Ban,
    bgColor: '#0A0A0A', // black
  },
  steep_grade: {
    label: 'Steep Grade',
    description: 'Too steep for safe ascent/descent',
    icon: TrendingUp,
    bgColor: '#7000FF', // purple
  },
  other: {
    label: 'Other Issue',
    description: 'Any other accessibility issue',
    icon: AlertTriangle,
    bgColor: '#7A7A7A', // gray
  },
} as const;

export type IssueType = keyof typeof ISSUE_TYPES;

export const SEVERITIES = {
  1: {
    label: 'Annoying',
    description: 'Passable but requires extra effort',
    colorClass: 'bg-[#A8FF60]', // lime green
    hex: '#A8FF60',
  },
  2: {
    label: 'Difficult',
    description: 'Very hard to pass, assistance might be needed',
    colorClass: 'bg-[#FFD400]', // bright yellow
    hex: '#FFD400',
  },
  3: {
    label: 'Impassable',
    description: 'Completely blocked or impossible to navigate',
    colorClass: 'bg-[#FF3366]', // hot red/pink
    hex: '#FF3366',
  },
} as const;

export type SeverityLevel = keyof typeof SEVERITIES;
