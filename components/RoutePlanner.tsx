'use client';

import React from 'react';
import { RouteCoordinate, ObstacleWarning } from '@/lib/routing';
import { ISSUE_TYPES, SEVERITIES, IssueType, SeverityLevel } from '@/lib/constants';
import { Compass, Crosshair, Sparkles, Navigation } from 'lucide-react';

interface RoutePlannerProps {
  start: RouteCoordinate | null;
  end: RouteCoordinate | null;
  selectMode: 'start' | 'end' | null;
  setSelectMode: (mode: 'start' | 'end' | null) => void;
  clearRoute: () => void;
  obstacles: ObstacleWarning[];
  avoidObstacles: boolean;
  setAvoidObstacles: (val: boolean) => void;
  pathLength: number; // in meters
  onSelectObstacle: (reportId: string) => void;
}

export default function RoutePlanner({
  start,
  end,
  selectMode,
  setSelectMode,
  clearRoute,
  obstacles,
  avoidObstacles,
  setAvoidObstacles,
  pathLength,
  onSelectObstacle,
}: RoutePlannerProps) {

  // Retrieve current location via browser API
  const handleUseMyLocation = (target: 'start' | 'end') => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          // Set selection callback logic (implemented in page.tsx)
          const customEvent = new CustomEvent('setRouteCoord', {
            detail: { target, lng: longitude, lat: latitude }
          });
          window.dispatchEvent(customEvent);
        },
        () => {
          alert('Could not retrieve your location. Make sure GPS/location services are enabled.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Format coordinate display
  const formatCoord = (coord: RouteCoordinate | null) => {
    if (!coord) return 'Not selected';
    return `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
  };

  // Calculate Walking Time (approx 1.2 m/s wheelchair speed)
  const formatTime = (meters: number) => {
    const speed = 1.2; // meters per second
    const seconds = meters / speed;
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return 'Under 1 min';
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs} hr ${mins} min`;
    }
    return `${minutes} min`;
  };

  // Calculate Accessibility Score
  const calculateAccessibilityScore = () => {
    let score = 100;
    obstacles.forEach((warning) => {
      const severity = warning.report.severity;
      if (severity === 3) score -= 40;
      else if (severity === 2) score -= 20;
      else if (severity === 1) score -= 10;
    });
    return Math.max(0, score);
  };

  const score = calculateAccessibilityScore();
  
  // Safety Rating Details
  const getSafetyInfo = (scoreValue: number) => {
    if (scoreValue >= 80) {
      return {
        label: 'Highly Accessible',
        bgColor: '#A8FF60', // lime green
        textColor: '#0A0A0A',
        description: 'Smooth crossing routes, minor or no obstructions detected.',
      };
    } else if (scoreValue >= 45) {
      return {
        label: 'Caution Required',
        bgColor: '#FFD400', // yellow
        textColor: '#0A0A0A',
        description: 'Some obstacles or uneven pathways reported. Accessible with care.',
      };
    } else {
      return {
        label: 'Impassable Obstacles',
        bgColor: '#FF3366', // hot pink / red
        textColor: '#ffffff',
        description: 'Severe obstructions or steps ahead. Manual wheelchair users may need support.',
      };
    }
  };

  const safety = getSafetyInfo(score);

  return (
    <div className="card-brutal bg-[#F5F2EA] p-4 w-full md:w-96 space-y-4 max-h-[85vh] md:max-h-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-[#0A0A0A]/20">
        <Compass className="h-4 w-4 text-[#0047FF] animate-spin" style={{ animationDuration: '6s' }} />
        <h4 className="font-space font-black text-sm uppercase tracking-wide text-[#0A0A0A]">
          Accessible Route Planner
        </h4>
      </div>

      {/* Inputs Section */}
      <div className="space-y-3">
        {/* START LOCATION INPUT */}
        <div className="space-y-1">
          <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60">
            Start Location (Green)
          </label>
          <div className="flex gap-1.5">
            <div className="input-brutal flex-1 text-xs font-semibold bg-white flex items-center justify-between min-w-0">
              <span className="truncate">{start ? formatCoord(start) : 'Pin your starting point...'}</span>
              {start && (
                <button
                  onClick={() => {
                    const event = new CustomEvent('setRouteCoord', { detail: { target: 'start', value: null } });
                    window.dispatchEvent(event);
                  }}
                  className="text-red-500 hover:text-red-700 font-extrabold ml-1 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Locate Me */}
            <button
              onClick={() => handleUseMyLocation('start')}
              className="btn-brutal-sm p-2 bg-white hover:bg-zinc-100"
              title="Use current location"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            {/* Pick on Map */}
            <button
              onClick={() => setSelectMode(selectMode === 'start' ? null : 'start')}
              className={`btn-brutal-sm px-2.5 text-[10px] font-black uppercase ${
                selectMode === 'start' ? 'bg-[#A8FF60]' : 'bg-white hover:bg-zinc-50'
              }`}
            >
              {selectMode === 'start' ? 'Selecting...' : 'Pick'}
            </button>
          </div>
        </div>

        {/* END LOCATION INPUT */}
        <div className="space-y-1">
          <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60">
            Destination Location (Pink)
          </label>
          <div className="flex gap-1.5">
            <div className="input-brutal flex-1 text-xs font-semibold bg-white flex items-center justify-between min-w-0">
              <span className="truncate">{end ? formatCoord(end) : 'Pin your destination...'}</span>
              {end && (
                <button
                  onClick={() => {
                    const event = new CustomEvent('setRouteCoord', { detail: { target: 'end', value: null } });
                    window.dispatchEvent(event);
                  }}
                  className="text-red-500 hover:text-red-700 font-extrabold ml-1 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Locate Me */}
            <button
              onClick={() => handleUseMyLocation('end')}
              className="btn-brutal-sm p-2 bg-white hover:bg-zinc-100"
              title="Use current location"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            {/* Pick on Map */}
            <button
              onClick={() => setSelectMode(selectMode === 'end' ? null : 'end')}
              className={`btn-brutal-sm px-2.5 text-[10px] font-black uppercase ${
                selectMode === 'end' ? 'bg-[#FF3399]' : 'bg-white hover:bg-zinc-50'
              }`}
            >
              {selectMode === 'end' ? 'Selecting...' : 'Pick'}
            </button>
          </div>
        </div>
      </div>

      {/* Helper text when selecting */}
      {selectMode && (
        <div className="border-brutal-sm bg-[#FFD400] p-2 text-[10px] font-black text-center uppercase tracking-wide animate-pulse">
          🎯 Click on the map to set your {selectMode === 'start' ? 'Starting Location' : 'Destination'}
        </div>
      )}

      {/* Route Info & Obstacles */}
      {start && end ? (
        <div className="space-y-4 pt-2 border-t border-[#0A0A0A]/10">
          
          {/* Path Stats */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="border-brutal-sm bg-white p-2.5">
              <span className="block text-sm font-black font-space">
                {(pathLength / 1000).toFixed(2)} km
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#0A0A0A]/50">Distance</span>
            </div>
            <div className="border-brutal-sm bg-white p-2.5">
              <span className="block text-sm font-black font-space">
                {formatTime(pathLength)}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#0A0A0A]/50">Est. Roll Time</span>
            </div>
          </div>

          {/* Safety Card */}
          <div 
            className="border-brutal-sm p-3.5 space-y-1.5 shadow-brutal-sm relative overflow-hidden"
            style={{ backgroundColor: safety.bgColor, color: safety.textColor }}
          >
            <div className="flex justify-between items-center">
              <span className="font-space font-black text-xs uppercase tracking-wider">
                Route Safety Score
              </span>
              <span className="font-space font-black text-lg">
                {score}/100
              </span>
            </div>
            <h5 className="font-space font-black text-md uppercase tracking-tight">
              {safety.label}
            </h5>
            <p className="text-[10px] font-bold leading-3.5 opacity-90">
              {safety.description}
            </p>
          </div>

          {/* Toggle Switch to Bypass Obstacles */}
          <div className="flex items-center justify-between p-2.5 border-brutal-sm bg-white">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase">Alternate Route Option</span>
              <span className="text-[8px] font-bold text-[#0A0A0A]/50 uppercase">Shift route corners</span>
            </div>
            <button
              onClick={() => setAvoidObstacles(!avoidObstacles)}
              className={`btn-brutal-sm px-3.5 py-1.5 text-[9px] font-black uppercase transition-all ${
                avoidObstacles ? 'bg-[#A8FF60]' : 'bg-zinc-200'
              }`}
            >
              {avoidObstacles ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Obstacles List */}
          <div className="space-y-2">
            <span className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60">
              Obstacles Detected ({obstacles.length})
            </span>

            {obstacles.length === 0 ? (
              <div className="border-brutal-sm bg-[#A8FF60]/10 p-3 text-center border-dashed border-[#A8FF60]">
                <Sparkles className="h-5 w-5 text-[#A8FF60] mx-auto mb-1 stroke-[2.5]" />
                <p className="text-[10px] font-extrabold text-green-700 uppercase">Clear path! No obstacles detected.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {obstacles.map((obs) => {
                  const issueType = obs.report.issue_type as IssueType;
                  const issueInfo = ISSUE_TYPES[issueType] || ISSUE_TYPES.other;
                  const severityInfo = SEVERITIES[obs.report.severity as SeverityLevel] || SEVERITIES[1];
                  const Icon = issueInfo.icon;
                  
                  return (
                    <button
                      key={obs.report.id}
                      onClick={() => onSelectObstacle(obs.report.id)}
                      className="w-full text-left p-2 border border-black bg-white hover:bg-zinc-50 hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="p-1 border border-black rounded-sm shrink-0"
                          style={{ backgroundColor: issueInfo.bgColor }}
                        >
                          <Icon className="h-3.5 w-3.5 text-black shrink-0" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[9px] font-extrabold uppercase truncate tracking-tight">
                            {issueInfo.label}
                          </span>
                          <span className="block text-[8px] font-bold text-[#0A0A0A]/60 uppercase leading-2 truncate">
                            {obs.report.description || 'No notes'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="badge-brutal text-[8px] py-0 px-1 border font-black uppercase text-[#0A0A0A]" style={{ backgroundColor: severityInfo.hex }}>
                          LVL {obs.report.severity}
                        </span>
                        <span className="text-[8px] font-extrabold text-[#0A0A0A]/50 font-mono mt-0.5">
                          +{obs.distanceFromStart}m
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reset button */}
          <button
            onClick={clearRoute}
            className="btn-brutal-sm w-full py-2.5 bg-[#FF3366] hover:bg-[#FF5500] text-white text-[10px] font-extrabold tracking-wider"
          >
            Clear Route Map
          </button>
        </div>
      ) : (
        <div className="border-brutal-sm bg-white p-5 text-center space-y-2 border-dashed">
          <Navigation className="h-6 w-6 text-[#0047FF] mx-auto animate-bounce stroke-[2.5]" />
          <p className="text-[10px] font-extrabold uppercase text-[#0A0A0A]/60 leading-3">
            Select a Start Point and destination to begin route safety assessment.
          </p>
          <div className="flex gap-2 justify-center pt-1.5">
            <button
              onClick={() => setSelectMode('start')}
              className="btn-brutal-sm py-1.5 px-3 bg-[#A8FF60] text-[9px] font-black"
            >
              Set Start
            </button>
            <button
              onClick={() => setSelectMode('end')}
              className="btn-brutal-sm py-1.5 px-3 bg-[#FF3399] text-white text-[9px] font-black"
            >
              Set Dest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
