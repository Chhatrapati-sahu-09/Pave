'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import AuthModal from '@/components/AuthModal';
import MapComponent from '@/components/Map';
import FilterPanel from '@/components/FilterPanel';
import ReportPanel from '@/components/ReportPanel';
import ReportForm from '@/components/ReportForm';
import { ISSUE_TYPES } from '@/lib/constants';
import { LogIn, LogOut, Plus, MapPin, Check, ThumbsDown, Footprints } from 'lucide-react';

interface Report {
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

export default function Home() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  
  // App States
  const [reports, setReports] = useState<Report[]>([]);
  const [viewportBounds, setViewportBounds] = useState<[number, number, number, number] | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'confirm' | 'dispute'>>({});
  
  // Form / Action States
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [tempPin, setTempPin] = useState<{ lng: number; lat: number } | null>(null);
  const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins');
  
  // Loading & Modal States
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [authSuccessCallback, setAuthSuccessCallback] = useState<(() => void) | null>(null);

  // Filters State
  const [selectedTypes, setSelectedTypes] = useState<string[]>(Object.keys(ISSUE_TYPES));
  const [minSeverity, setMinSeverity] = useState<number>(1);

  // Fetch reports based on viewport bounds and filters
  const fetchReports = async (bounds: [number, number, number, number]) => {
    setIsLoadingReports(true);
    try {
      const [minLng, minLat, maxLng, maxLat] = bounds;
      
      // If no categories selected, return empty array immediately
      if (selectedTypes.length === 0) {
        setReports([]);
        setIsLoadingReports(false);
        return;
      }

      const typesParam = selectedTypes.length === Object.keys(ISSUE_TYPES).length
        ? '' // empty means fetch all to save URL space
        : selectedTypes.join(',');

      const url = `/api/reports?min_lng=${minLng}&min_lat=${minLat}&max_lng=${maxLng}&max_lat=${maxLat}&issue_types=${typesParam}&min_severity=${minSeverity}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Trigger fetch when bounds or filters change
  useEffect(() => {
    if (viewportBounds) {
      fetchReports(viewportBounds);
    }
  }, [viewportBounds, selectedTypes, minSeverity]);

  // Load user votes on authentication change
  useEffect(() => {
    const fetchUserVotes = async () => {
      if (!user) {
        setUserVotes({});
        return;
      }
      try {
        const res = await fetch('/api/confirmations');
        if (res.ok) {
          const data = await res.json();
          const votesMap: Record<string, 'confirm' | 'dispute'> = {};
          data.votes.forEach((v: { report_id: string; vote: 'confirm' | 'dispute' }) => {
            votesMap[v.report_id] = v.vote;
          });
          setUserVotes(votesMap);
        }
      } catch (err) {
        console.error('Error loading user votes:', err);
      }
    };

    fetchUserVotes();
  }, [user]);

  // Handle map movement end
  const handleViewportChange = (bounds: [number, number, number, number]) => {
    setViewportBounds(bounds);
  };

  // Open login modal with helper callback
  const promptLogin = (onSuccessAction: () => void) => {
    setAuthSuccessCallback(() => onSuccessAction);
    setIsAuthModalOpen(true);
  };

  // Trigger pin-drop mode
  const handleStartReport = () => {
    if (!user) {
      promptLogin(() => {
        setIsPinDropMode(true);
      });
      return;
    }
    setSelectedReport(null); // clear selection
    setIsPinDropMode(true);
  };

  // Cancel pin-drop or form submission
  const handleCancelReport = () => {
    setIsPinDropMode(false);
    setTempPin(null);
  };

  // Successful report submission (optimistic update)
  const handleReportSubmitSuccess = (newReport: Report) => {
    // Add report to state list optimistically
    setReports((prev) => [newReport, ...prev]);
    // Close drop-pin mode
    setIsPinDropMode(false);
    setTempPin(null);
    // Select the new report
    setSelectedReport(newReport);
  };

  // Handle confirm/dispute voting
  const handleVote = async (voteType: 'confirm' | 'dispute') => {
    if (!selectedReport) return;
    if (!user) {
      promptLogin(() => handleVote(voteType));
      return;
    }

    setIsVoting(true);
    const reportId = selectedReport.id;
    const previousVote = userVotes[reportId];

    try {
      const res = await fetch('/api/confirmations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          vote: voteType,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit vote');
      }

      // Update local votes mapping
      setUserVotes((prev) => ({ ...prev, [reportId]: voteType }));

      // Adjust counts and status in state list optimistically
      setReports((prevReports) =>
        prevReports.map((r) => {
          if (r.id === reportId) {
            let confirms = Number(r.confirm_count);
            let disputes = Number(r.dispute_count);

            // Remove previous vote from totals
            if (previousVote === 'confirm') confirms = Math.max(0, confirms - 1);
            if (previousVote === 'dispute') disputes = Math.max(0, disputes - 1);

            // Add new vote to totals
            if (voteType === 'confirm') confirms += 1;
            if (voteType === 'dispute') disputes += 1;

            // Check if status changes to disputed (3+ disputes and <=1 confirms)
            let status = r.status;
            if (disputes >= 3 && confirms <= 1) {
              status = 'disputed';
            } else if (status === 'disputed' && !(disputes >= 3 && confirms <= 1)) {
              status = 'active';
            }

            const updated = {
              ...r,
              confirm_count: confirms,
              dispute_count: disputes,
              status,
            };

            // Sync currently open report panel details
            setSelectedReport(updated);

            return updated;
          }
          return r;
        })
      );
    } catch (err) {
      console.error('Error voting:', err);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F2EA] text-[#0A0A0A]">
      {/* 1. HEADER / NAVBAR (Neo-Brutalist styling) */}
      <header className="flex justify-between items-center px-4 md:px-6 py-3 border-b-3 border-black bg-white z-20">
        <div className="flex items-center gap-2 select-none">
          <div className="border-brutal-sm p-1 bg-[#0047FF] text-white flex items-center justify-center shrink-0">
            <Footprints className="h-6 w-6 stroke-[3]" />
          </div>
          <span className="font-space font-black text-2xl tracking-widest text-[#0047FF]">
            PAVE
          </span>
        </div>

        {/* User Account controls */}
        <div className="flex items-center gap-3">
          {authLoading ? (
            <div className="text-xs font-bold uppercase tracking-wider animate-pulse">
              Authenticating...
            </div>
          ) : user ? (
            <>
              {/* Profile display chip (slightly rotated badge style) */}
              <div className="hidden sm:inline-block badge-brutal bg-[#A8FF60] text-xs py-1 px-3 rotate-[-1deg] shadow-brutal-sm font-black border-2 border-black">
                👤 {profile?.display_name || user.email?.split('@')[0] || 'User'}
              </div>
              <button
                onClick={signOut}
                className="btn-brutal-sm px-3 py-1.5 bg-[#FF3366] hover:bg-[#FF5500] text-xs font-black flex items-center gap-1 text-white border-2 border-black"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="btn-brutal px-4 py-1.5 bg-[#0047FF] hover:bg-[#FF3399] text-xs font-black flex items-center gap-1.5 text-white border-2 border-black"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN MAP VIEW CONTAINER */}
      <main className="flex-1 flex relative overflow-hidden h-[calc(100vh-60px)]">
        {/* MAP COMPONENT (Full Screen) */}
        <MapComponent
          reports={reports}
          onViewportChange={handleViewportChange}
          onSelectReport={setSelectedReport}
          selectedReport={selectedReport}
          isPinDropMode={isPinDropMode}
          setIsPinDropMode={setIsPinDropMode}
          tempPin={tempPin}
          setTempPin={setTempPin}
          viewMode={viewMode}
          setViewMode={setViewMode}
          isLoading={isLoadingReports}
        />

        {/* FLOATING ACTION PANELS (Overlaid on top of map) */}
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between md:flex-row z-10">
          
          {/* LEFT COLUMN: FILTERS & CONTROLS */}
          <div className="flex flex-col gap-3 items-start pointer-events-none max-w-full md:w-80 overflow-y-auto">
            {/* Filters (Always visible on all screens) */}
            <div className="pointer-events-auto w-full max-w-sm md:max-w-none">
              <FilterPanel
                selectedTypes={selectedTypes}
                onChangeTypes={setSelectedTypes}
                minSeverity={minSeverity}
                onChangeSeverity={setMinSeverity}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: ACTION DRAWERS (Forms or report details) */}
          <div className="flex flex-col justify-end md:justify-start items-end pointer-events-none w-full md:w-96 md:h-full overflow-y-auto pt-4 md:pt-0">
            {/* 2a. REPORT FORM DRAWER */}
            {isPinDropMode && tempPin && (
              <div className="w-full pointer-events-auto md:max-h-full">
                <ReportForm
                  lng={tempPin.lng}
                  lat={tempPin.lat}
                  onSubmitSuccess={handleReportSubmitSuccess}
                  onCancel={handleCancelReport}
                />
              </div>
            )}

            {/* 2b. REPORT DETAIL PANEL DRAWER */}
            {selectedReport && !isPinDropMode && (
              <div className="w-full pointer-events-auto md:max-h-full">
                <ReportPanel
                  report={selectedReport}
                  userVote={userVotes[selectedReport.id] || null}
                  onVote={handleVote}
                  onClose={() => setSelectedReport(null)}
                  isVoting={isVoting}
                  isLoggedIn={!!user}
                  onAuthPrompt={() => promptLogin(() => {})}
                />
              </div>
            )}
          </div>

        </div>

        {/* FLOATING ACTION BUTTON: "REPORT AN ISSUE" (Bottom Center Desktop / Top Right Mobile) */}
        {!isPinDropMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            <button
              onClick={handleStartReport}
              className="btn-brutal px-6 py-4 bg-[#FF5500] hover:bg-[#A8FF60] text-black text-sm font-extrabold flex items-center gap-2 shadow-brutal border-3 border-black whitespace-nowrap"
            >
              <Plus className="h-5 w-5 stroke-[3]" />
              Report Accessibility Issue
            </button>
          </div>
        )}

        {/* Exit Banner during Pin-Drop mode */}
        {isPinDropMode && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
            <div className="flex gap-2">
              <button
                onClick={handleCancelReport}
                className="btn-brutal-sm px-4 py-2 bg-white text-black text-xs font-black uppercase shadow-brutal-sm border-2 border-black"
              >
                Cancel Report Mode
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. AUTH INLINE MODAL WINDOW */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthSuccessCallback(null);
        }}
        onSuccess={() => {
          if (authSuccessCallback) {
            authSuccessCallback();
            setAuthSuccessCallback(null);
          }
        }}
      />
    </div>
  );
}
