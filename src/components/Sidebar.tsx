import React, { useState } from 'react';
import { Search, Video, Eye, EyeOff } from 'lucide-react';
import { Camera } from '../types';

interface SidebarProps {
  cameras: Camera[];
  onSelectCamera: (x: number) => void;
  hideAtNextCamera: boolean;
  onToggleHideAtNextCamera: () => void;
}

export default function Sidebar({ cameras, onSelectCamera, hideAtNextCamera, onToggleHideAtNextCamera }: SidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = cameras.filter(c => c.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
      <div className="p-4 border-b border-slate-800 space-y-4 bg-slate-900/95 backdrop-blur">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Video className="w-5 h-5 text-indigo-400" />
          Traffic Monitor
        </h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search cameras..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
          />
        </div>
        <button
          onClick={onToggleHideAtNextCamera}
          className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
            hideAtNextCamera
              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {hideAtNextCamera ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="text-xs font-semibold uppercase tracking-wider">
            {hideAtNextCamera ? 'Hide at Next Cam' : 'Show Past Next Cam'}
          </span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filtered.map(cam => (
          <button
            key={cam.id}
            onClick={() => onSelectCamera(cam.x)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 transition-colors text-left group border border-transparent hover:border-slate-700"
          >
            <span className="text-slate-300 font-medium group-hover:text-indigo-400 transition-colors flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-400"></div>
              {cam.id}
            </span>
            <span className="text-slate-500 text-xs font-mono bg-slate-950 px-2 py-1 rounded">
              {(cam.x / 1000).toFixed(1)}km
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            No cameras found.
          </div>
        )}
      </div>
    </div>
  );
}
