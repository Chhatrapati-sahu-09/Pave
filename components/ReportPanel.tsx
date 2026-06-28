'use client';

import React from 'react';
import { X, Check, ThumbsDown, Calendar, User, EyeOff } from 'lucide-react';
import { ISSUE_TYPES, SEVERITIES, IssueType, SeverityLevel } from '@/lib/constants';

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

interface ReportPanelProps {
  report: Report | null;
  userVote: 'confirm' | 'dispute' | null;
  onVote: (voteType: 'confirm' | 'dispute') => void;
  onClose: () => void;
  isVoting: boolean;
  isLoggedIn: boolean;
  onAuthPrompt: () => void;
}

export default function ReportPanel({
  report,
  userVote,
  onVote,
  onClose,
  isVoting,
  isLoggedIn,
  onAuthPrompt,
}: ReportPanelProps) {
  if (!report) return null;

  const issueInfo = ISSUE_TYPES[report.issue_type as IssueType] || ISSUE_TYPES.other;
  const severityInfo = SEVERITIES[report.severity as SeverityLevel] || SEVERITIES[1];
  const IssueIcon = issueInfo.icon;

  const formattedDate = new Date(report.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleVoteClick = (type: 'confirm' | 'dispute') => {
    if (!isLoggedIn) {
      onAuthPrompt();
      return;
    }
    onVote(type);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:relative md:inset-auto md:w-96 md:h-full flex flex-col pointer-events-auto">
      {/* Mobile Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/30 md:hidden z-[-1]"
        onClick={onClose}
      />

      {/* Main Details Drawer */}
      <div className="card-brutal bg-[#F5F2EA] w-full md:h-full max-h-[85vh] md:max-h-none flex flex-col overflow-hidden pointer-events-auto">
        {/* Panel Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b-2 border-black bg-white">
          <div className="flex items-center gap-2">
            <span 
              className="badge-brutal text-xs font-black inline-flex items-center gap-1 scale-95"
              style={{ backgroundColor: severityInfo.hex }}
            >
              LEVEL {report.severity} — {severityInfo.label}
            </span>
            {report.status === 'disputed' && (
              <span className="badge-brutal bg-[#0A0A0A] text-white text-[10px] py-0.5 px-1.5 flex items-center gap-1 select-none">
                <EyeOff className="h-2.5 w-2.5" /> Disputed
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-brutal-sm p-1 bg-[#FF3366] hover:bg-[#FF5500]"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          
          {/* Asymmetric / Sticker-style Issue Badge */}
          <div className="flex items-start justify-between">
            <div 
              className="badge-brutal border-3 border-black text-[#0A0A0A] px-4 py-2 rotate-[-1.5deg] shadow-brutal-sm inline-flex items-center gap-2 max-w-[90%] shrink-0"
              style={{ backgroundColor: issueInfo.bgColor, color: issueInfo.bgColor === '#0A0A0A' ? '#ffffff' : '#0A0A0A' }}
            >
              <IssueIcon className="h-5 w-5 shrink-0" />
              <span className="font-space font-black text-sm uppercase tracking-wide">
                {issueInfo.label}
              </span>
            </div>
          </div>

          {/* Metadata Block */}
          <div className="border-brutal-sm bg-white p-3 text-xs space-y-1.5 font-semibold text-[#0A0A0A]/70">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>Reported by: <span className="text-[#0A0A0A] font-bold">{report.reporter_name || 'Anonymous'}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Date: <span className="text-[#0A0A0A] font-bold">{formattedDate}</span></span>
            </div>
            <div className="text-[10px] font-mono mt-1 text-[#0A0A0A]/50">
              COORD: {report.location_lat.toFixed(6)}, {report.location_lng.toFixed(6)}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60 mb-1">
              Description / Notes
            </label>
            <div className="border-brutal-sm bg-white p-3 text-sm font-medium leading-5">
              {report.description ? (
                <p className="whitespace-pre-wrap">{report.description}</p>
              ) : (
                <p className="italic text-[#0A0A0A]/40">No description provided.</p>
              )}
            </div>
          </div>

          {/* Photo Attachment if present */}
          {report.photo_url && (
            <div>
              <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60 mb-1">
                Photo Evidence
              </label>
              <div className="border-brutal-sm bg-white p-2">
                <img
                  src={report.photo_url}
                  alt={issueInfo.label}
                  className="w-full max-h-48 object-cover border-2 border-black"
                  onError={(e) => {
                    // Hide if image fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Confirms & Disputes Vote section */}
          <div className="border-brutal-sm bg-[#ffffff] p-4 space-y-3">
            <h4 className="font-space font-black text-xs uppercase tracking-wider text-[#0A0A0A] pb-1 border-b border-[#0A0A0A]/10">
              Crowdsourced Verification
            </h4>
            
            <div className="grid grid-cols-2 gap-3 text-center">
              {/* Confirms counter block */}
              <div className="border-brutal-sm bg-[#A8FF60]/10 p-2">
                <span className="block text-2xl font-black font-space">{report.confirm_count}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/70">Confirms</span>
              </div>
              {/* Disputes counter block */}
              <div className="border-brutal-sm bg-[#FF3366]/10 p-2">
                <span className="block text-2xl font-black font-space">{report.dispute_count}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/70">Disputes</span>
              </div>
            </div>

            {report.status === 'disputed' && (
              <p className="text-[10px] font-semibold text-[#FF3366] uppercase text-center leading-3">
                ⚠️ This report has 3+ dispute votes and few/no confirms. It is flagged as disputed.
              </p>
            )}

            {/* Voting Action Buttons */}
            <div className="flex gap-2 pt-2">
              {/* Confirm Vote Button */}
              <button
                onClick={() => handleVoteClick('confirm')}
                disabled={isVoting}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 border-2 border-black transition-all cursor-pointer ${
                  userVote === 'confirm'
                    ? 'translate-x-[2px] translate-y-[2px] shadow-none bg-[#A8FF60]'
                    : 'bg-white hover:bg-[#A8FF60]/20 shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                }`}
              >
                <Check className={`h-4 w-4 mb-0.5 ${userVote === 'confirm' ? 'stroke-[3px]' : ''}`} />
                <span className="font-space font-black text-[10px] uppercase leading-3">Still There</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">(Confirm)</span>
              </button>

              {/* Dispute Vote Button */}
              <button
                onClick={() => handleVoteClick('dispute')}
                disabled={isVoting}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 border-2 border-black transition-all cursor-pointer ${
                  userVote === 'dispute'
                    ? 'translate-x-[2px] translate-y-[2px] shadow-none bg-[#FF3366] text-white'
                    : 'bg-white hover:bg-[#FF3366]/20 shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                }`}
              >
                <ThumbsDown className={`h-4 w-4 mb-0.5 ${userVote === 'dispute' ? 'stroke-[3px]' : ''}`} />
                <span className="font-space font-black text-[10px] uppercase leading-3">Fixed / Not Acc</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">(Dispute)</span>
              </button>
            </div>

            {!isLoggedIn && (
              <p className="text-[9px] font-bold text-[#0047FF] text-center uppercase tracking-wide">
                * Sign in required to verify or dispute issues
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
