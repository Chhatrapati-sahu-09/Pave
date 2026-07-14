'use client';

import React from 'react';
import { ISSUE_TYPES, SEVERITIES, SeverityLevel } from '@/lib/constants';
import { SlidersHorizontal } from 'lucide-react';

interface FilterPanelProps {
  selectedTypes: string[];
  onChangeTypes: (types: string[]) => void;
  minSeverity: number;
  onChangeSeverity: (severity: number) => void;
}

export default function FilterPanel({
  selectedTypes,
  onChangeTypes,
  minSeverity,
  onChangeSeverity,
}: FilterPanelProps) {

  const handleToggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      // If it's the last one, don't allow deselecting everything, or let them deselect.
      // Usually, deselecting all is fine (means show none, or we can treat empty as show all).
      // Let's allow deselecting, but if it's empty, we'll fetch nothing.
      onChangeTypes(selectedTypes.filter((t) => t !== type));
    } else {
      onChangeTypes([...selectedTypes, type]);
    }
  };

  const handleSelectAllTypes = () => {
    onChangeTypes(Object.keys(ISSUE_TYPES));
  };

  const handleClearAllTypes = () => {
    onChangeTypes([]);
  };

  return (
    <div className="card-brutal bg-[#F5F2EA] p-4 w-full md:w-80 space-y-4">
      {/* Panel Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-[#0A0A0A]/20">
        <SlidersHorizontal className="h-4 w-4 text-[#0047FF]" />
        <h4 className="font-space font-black text-sm uppercase tracking-wide text-[#0A0A0A]">
          Filter Accessibility map
        </h4>
      </div>

      {/* Issue Types Filters */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60">
            Issue Categories
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAllTypes}
              className="text-[9px] font-bold text-[#0047FF] hover:underline uppercase"
            >
              All
            </button>
            <button
              onClick={handleClearAllTypes}
              className="text-[9px] font-bold text-[#FF3366] hover:underline uppercase"
            >
              None
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(ISSUE_TYPES).map(([type, data]) => {
            const isSelected = selectedTypes.includes(type);
            const Icon = data.icon;
            return (
              <button
                key={type}
                onClick={() => handleToggleType(type)}
                className={`flex items-center gap-1.5 p-2 text-left border border-black text-[10px] font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? 'shadow-brutal-sm scale-[1.01]'
                    : 'bg-[#F5F2EA] hover:bg-white text-[#0A0A0A]/70'
                }`}
                style={{
                  backgroundColor: isSelected ? data.bgColor : '#F5F2EA',
                  color: isSelected ? (data.bgColor === '#0A0A0A' ? '#ffffff' : '#0A0A0A') : '#0A0A0A',
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate uppercase tracking-tight">{data.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity Filter */}
      <div className="space-y-2">
        <label className="block font-space font-extrabold uppercase text-[10px] tracking-wider text-[#0A0A0A]/60">
          Minimum Severity
        </label>
        
        {/* Brutalist segmented control */}
        <div className="flex border-2 border-black bg-white">
          {[1, 2, 3].map((lvl) => {
            const isSelected = minSeverity === lvl;
            const sevInfo = SEVERITIES[lvl as SeverityLevel];
            return (
              <button
                key={lvl}
                onClick={() => onChangeSeverity(lvl)}
                className={`flex-1 py-2 text-center text-xs font-black uppercase transition-all border-r last:border-r-0 border-black cursor-pointer ${
                  isSelected 
                    ? 'text-black' 
                    : 'bg-white hover:bg-zinc-100 text-[#0A0A0A]/50'
                }`}
                style={{
                  backgroundColor: isSelected ? sevInfo.hex : 'transparent',
                }}
              >
                Lvl {lvl}
              </button>
            );
          })}
        </div>
        <div className="text-[9px] font-semibold text-[#0A0A0A]/50 text-center uppercase tracking-wide">
          Showing issues: {SEVERITIES[minSeverity as SeverityLevel]?.label} & above
        </div>
      </div>
    </div>
  );
}
