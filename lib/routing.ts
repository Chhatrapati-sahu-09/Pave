export interface RouteCoordinate {
  lng: number;
  lat: number;
}

export interface Report {
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

export interface ObstacleWarning {
  report: Report;
  distanceFromStart: number; // meters from start of path
}

/**
 * Calculates the Haversine distance in meters between two coordinates.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Determines if a report location is within a certain distance buffer (in meters) of a line segment.
 */
export function isPointNearSegment(
  ptLat: number,
  ptLng: number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  maxDistanceMeters: number = 35
): boolean {
  const distAB = getDistance(startLat, startLng, endLat, endLng);
  // Interpolate points along the segment every 8 meters to check proximity
  const stepSize = 8;
  const numSteps = Math.max(1, Math.ceil(distAB / stepSize));

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const lat = startLat + t * (endLat - startLat);
    const lng = startLng + t * (endLng - startLng);
    if (getDistance(ptLat, ptLng, lat, lng) <= maxDistanceMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Generates coordinates for a Manhattan grid route path (right angle bend).
 * Toggle "alternate" to bend the opposite way.
 */
export function generateManhattanPath(
  start: RouteCoordinate,
  end: RouteCoordinate,
  alternate: boolean = false
): RouteCoordinate[] {
  if (alternate) {
    // Path: Start -> Corner (End.lat, Start.lng) -> End
    return [
      start,
      { lat: end.lat, lng: start.lng },
      end
    ];
  } else {
    // Path: Start -> Corner (Start.lat, End.lng) -> End
    return [
      start,
      { lat: start.lat, lng: end.lng },
      end
    ];
  }
}

/**
 * Returns the total cumulative length of a path in meters.
 */
export function getPathLength(path: RouteCoordinate[]): number {
  let length = 0;
  for (let i = 0; i < path.length - 1; i++) {
    length += getDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  return length;
}

/**
 * Finds all reports within a buffer of the path, calculating approximate distance from the start point.
 */
export function findObstaclesOnPath(
  path: RouteCoordinate[],
  reports: Report[],
  bufferMeters: number = 35
): ObstacleWarning[] {
  const warnings: ObstacleWarning[] = [];
  const processedReports = new Set<string>();

  // Check each segment of the path
  for (let i = 0; i < path.length - 1; i++) {
    const segStart = path[i];
    const segEnd = path[i + 1];
    
    // Distance from route start to the beginning of this segment
    let distanceToSegStart = 0;
    for (let k = 0; k < i; k++) {
      distanceToSegStart += getDistance(path[k].lat, path[k].lng, path[k + 1].lat, path[k + 1].lng);
    }

    for (const report of reports) {
      // Skip resolved reports, only inspect active and disputed issues
      if (report.status === 'resolved' || processedReports.has(report.id)) {
        continue;
      }

      const isNear = isPointNearSegment(
        report.location_lat,
        report.location_lng,
        segStart.lat,
        segStart.lng,
        segEnd.lat,
        segEnd.lng,
        bufferMeters
      );

      if (isNear) {
        processedReports.add(report.id);
        
        // Approximate where on the segment the report is
        // We find the interpolated step on the segment closest to the report
        const segLen = getDistance(segStart.lat, segStart.lng, segEnd.lat, segEnd.lng);
        const stepSize = 8;
        const numSteps = Math.max(1, Math.ceil(segLen / stepSize));
        
        let minStepDist = Infinity;
        let bestT = 0;
        
        for (let j = 0; j <= numSteps; j++) {
          const t = j / numSteps;
          const stepLat = segStart.lat + t * (segEnd.lat - segStart.lat);
          const stepLng = segStart.lng + t * (segEnd.lng - segStart.lng);
          const d = getDistance(report.location_lat, report.location_lng, stepLat, stepLng);
          if (d < minStepDist) {
            minStepDist = d;
            bestT = t;
          }
        }

        const distanceFromStart = distanceToSegStart + bestT * segLen;
        
        warnings.push({
          report,
          distanceFromStart: Math.round(distanceFromStart),
        });
      }
    }
  }

  // Sort warnings by their distance from the start of the path
  return warnings.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
}
