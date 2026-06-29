'use client';

import React, { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ISSUE_TYPES, SEVERITIES, IssueType, SeverityLevel } from '@/lib/constants';
import { Camera, X, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

interface ReportFormProps {
  lng: number;
  lat: number;
  onSubmitSuccess: (newReport: any) => void;
  onCancel: () => void;
}

export default function ReportForm({ lng, lat, onSubmitSuccess, onCancel }: ReportFormProps) {
  const { user } = useAuth();
  const [issueType, setIssueType] = useState<IssueType>('no_curb_cut');
  const [severity, setSeverity] = useState<SeverityLevel>(1);
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('You must be signed in to submit a report.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let photoUrl = null;

      // 1. Upload photo if selected
      if (photoFile) {
        const isSupabaseConfigured = 
          process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
          process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

        if (!isSupabaseConfigured) {
          // Use a local blob URL in mock mode to display the image on the client
          photoUrl = URL.createObjectURL(photoFile);
        } else {
          const fileExt = photoFile.name.split('.').pop();
          const fileName = `${user.id}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('report-photos')
            .upload(filePath, photoFile);

          if (uploadError) {
            console.warn('Storage upload failed, falling back to local object URL:', uploadError.message);
            photoUrl = URL.createObjectURL(photoFile);
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('report-photos')
              .getPublicUrl(filePath);

            photoUrl = publicUrl;
          }
        }
      }

      // 2. Submit report to our API
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lng,
          lat,
          issue_type: issueType,
          severity,
          description: description.trim() || null,
          photo_url: photoUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit report');
      }

      // Call success callback (with optimistic update support)
      onSubmitSuccess({
        id: result.report?.id || Math.random().toString(), // fallback ID for safety
        reporter_id: user.id,
        reporter_name: user.email || 'You',
        location_lng: lng,
        location_lat: lat,
        issue_type: issueType,
        severity,
        description: description.trim() || null,
        photo_url: photoUrl,
        status: 'active',
        created_at: new Date().toISOString(),
        confirm_count: 0,
        dispute_count: 0,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during submission');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-brutal bg-[#F5F2EA] p-5 w-full max-h-[85vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-black">
        <h3 className="font-space text-lg font-black uppercase text-[#0A0A0A]">
          Report Accessibility Issue
        </h3>
        <button
          onClick={onCancel}
          className="btn-brutal-sm p-1 bg-[#FF3366] hover:bg-[#FF5500]"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="border-brutal-sm bg-[#FF3366] p-3 mb-4 text-white font-bold text-xs uppercase shadow-brutal-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Issue Location Coordinate Display */}
        <div className="border-brutal-sm bg-white p-2 text-xs font-mono font-semibold flex justify-between bg-zinc-50">
          <span>LAT: {lat.toFixed(6)}</span>
          <span>LNG: {lng.toFixed(6)}</span>
        </div>

        {/* Issue Type */}
        <div>
          <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-2">
            What is the issue?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ISSUE_TYPES).map(([type, data]) => {
              const Icon = data.icon;
              const isSelected = issueType === type;
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => setIssueType(type as IssueType)}
                  className={`flex flex-col items-center justify-center p-3 text-center transition-all ${
                    isSelected
                      ? 'border-brutal-sm shadow-brutal bg-[#0047FF] text-white scale-[1.02]'
                      : 'border-brutal-sm bg-white text-[#0A0A0A] hover:bg-zinc-100 shadow-brutal-sm'
                  }`}
                  style={{
                    backgroundColor: isSelected ? data.bgColor : '#ffffff',
                    color: isSelected ? (data.bgColor === '#0A0A0A' ? '#ffffff' : '#0A0A0A') : '#0A0A0A',
                  }}
                >
                  <Icon className="h-5 w-5 mb-1 shrink-0" />
                  <span className="font-space font-bold text-xs tracking-tight uppercase leading-3">
                    {data.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity Slider/Grid */}
        <div>
          <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-2">
            How severe is it?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SEVERITIES).map(([lvl, data]) => {
              const numLvl = parseInt(lvl, 10) as SeverityLevel;
              const isSelected = severity === numLvl;
              return (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setSeverity(numLvl)}
                  className={`flex flex-col p-2 text-left transition-all ${
                    isSelected
                      ? 'border-brutal-sm shadow-brutal border-black scale-[1.02]'
                      : 'border-brutal-sm bg-white hover:bg-zinc-100 shadow-brutal-sm'
                  }`}
                  style={{
                    backgroundColor: isSelected ? data.hex : '#ffffff',
                    color: '#0A0A0A',
                  }}
                >
                  <span className="font-space font-black text-sm uppercase leading-4">
                    LVL {lvl}
                  </span>
                  <span className="font-space font-extrabold text-[10px] uppercase tracking-wide">
                    {data.label}
                  </span>
                  <span className="text-[9px] font-medium leading-3 mt-1 text-[#0A0A0A]/70 line-clamp-2">
                    {data.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-1">
            Details (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Add details like 'sidewalk blocked by store display' or 'curb cut has a 3 inch lip'."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-brutal w-full text-xs font-semibold"
          />
        </div>

        {/* Optional Photo Attachment */}
        <div>
          <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-1">
            Attach Photo (Optional)
          </label>
          {photoPreview ? (
            <div className="relative border-brutal-sm bg-white p-2 flex items-center justify-center">
              <img
                src={photoPreview}
                alt="Upload preview"
                className="max-h-40 object-contain border-2 border-black"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="btn-brutal-sm absolute top-4 right-4 p-1 bg-[#FF3366] hover:bg-[#FF5500]"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-brutal-sm w-full py-4 bg-[#FFD400] hover:bg-[#A8FF60] flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              <span className="font-space font-extrabold text-xs uppercase">Take / Upload Photo</span>
            </button>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-brutal-sm flex-1 py-3 bg-white text-black text-xs font-extrabold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-brutal flex-1 py-3 bg-[#A8FF60] text-black text-xs font-extrabold disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
