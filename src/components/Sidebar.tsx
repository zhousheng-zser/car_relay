import React, { useState } from 'react';
import { Search, Video, Eye, EyeOff, RefreshCw, Radio, Activity } from 'lucide-react';
import { Camera } from '../types';

interface SidebarProps {
  cameras: Camera[];
  onSelectCamera: (x: number) => void;
  hideAtNextCamera: boolean;
  onToggleHideAtNextCamera: () => void;
  onSyncRemote: () => void;
  onReloadConfig: () => void;
  statusMessage: string;
  isBusy: boolean;
  connectedCameraCount: number;
  carCount: number;
}

export default function Sidebar({
  cameras,
  onSelectCamera,
  hideAtNextCamera,
  onToggleHideAtNextCamera,
  onSyncRemote,
  onReloadConfig,
  statusMessage,
  isBusy,
  connectedCameraCount,
  carCount,
}: SidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = cameras.filter((camera) => camera.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
      <div className="p-4 border-b border-slate-800 space-y-4 bg-slate-900/95 backdrop-blur">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Video className="w-5 h-5 text-indigo-400" />
          Radar Relay
        </h1>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatCard icon={<Radio className="w-4 h-4 text-emerald-400" />} label="Connected" value={`${connectedCameraCount}/${cameras.length}`} />
          <StatCard icon={<Activity className="w-4 h-4 text-cyan-400" />} label="Targets" value={`${carCount}`} />
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search cameras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onSyncRemote}
            disabled={isBusy}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
          >
            <Radio className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Sync Remote</span>
          </button>
          <button
            onClick={onReloadConfig}
            disabled={isBusy}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
            <span className="text-xs font-semibold uppercase tracking-wider">Reload Config</span>
          </button>
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

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400 min-h-10">
          {statusMessage || 'Waiting for backend activity...'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filtered.map((cam) => (
          <button
            key={cam.id}
            onClick={() => onSelectCamera(cam.x)}
            className="w-full p-3 rounded-lg hover:bg-slate-800 transition-colors text-left group border border-transparent hover:border-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 font-medium group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${cam.connected ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                {cam.id}
              </span>
              <span className="text-slate-500 text-xs font-mono bg-slate-950 px-2 py-1 rounded">
                {(cam.x / 1000).toFixed(1)}km
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{cam.direction || '未标注方向'}</span>
              <span>{cam.targetCount ?? 0} targets</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-600 font-mono truncate">
              {cam.lastUpdate || 'No update yet'}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div className="text-center text-slate-500 text-sm py-8">No cameras found.</div>}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-mono text-slate-100 text-sm">{value}</div>
    </div>
  );
}
