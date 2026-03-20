import React from 'react';
import { Bug, Radio, Clock3 } from 'lucide-react';

interface RemoteTarget {
  [key: string]: unknown;
}

interface RemoteCameraState {
  connected?: boolean;
  last_update?: string;
  targets?: RemoteTarget[];
}

interface DebugSnapshot {
  fetchedAt?: string;
  remoteTimestamp?: string;
  cameraCount?: number;
  connectedCameraCount?: number;
  payload?: Record<string, RemoteCameraState>;
}

export default function DebugPanel({
  debug,
  isOpen,
  onToggle,
}: {
  debug: DebugSnapshot | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const entries = Object.entries(debug?.payload || {});

  return (
    <div className="absolute top-6 left-6 w-[26rem] max-h-[70vh] rounded-2xl border border-amber-500/20 bg-slate-900/85 shadow-2xl backdrop-blur-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-amber-300">
          <Bug className="w-4 h-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">Remote Debug Stream</span>
        </div>
        <span className="text-xs text-slate-400">{isOpen ? 'Hide' : 'Show'}</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(70vh-56px)]">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Cameras" value={`${debug?.cameraCount ?? 0}`} icon={<Radio className="w-4 h-4 text-cyan-400" />} />
            <Stat label="Connected" value={`${debug?.connectedCameraCount ?? 0}`} icon={<Radio className="w-4 h-4 text-emerald-400" />} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-2">
            <Row label="Fetched At" value={debug?.fetchedAt || '-'} />
            <Row label="Remote Time" value={debug?.remoteTimestamp || '-'} />
          </div>

          {entries.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
              暂时还没有收到远端雷达数据。
            </div>
          )}

          {entries.map(([ip, state]) => (
            <div key={ip} className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-mono text-slate-100">{ip}</div>
                  <div className="text-[11px] text-slate-500">{state.last_update || 'No update timestamp'}</div>
                </div>
                <div className={`text-xs font-semibold ${state.connected ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {state.connected ? 'CONNECTED' : 'OFFLINE'}
                </div>
              </div>

              <div className="px-3 py-2 text-xs text-slate-400 flex items-center justify-between">
                <span>targets: {state.targets?.length || 0}</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  raw preview
                </span>
              </div>

              <div className="px-3 pb-3 space-y-2">
                {(state.targets || []).slice(0, 3).map((target, index) => (
                  <pre
                    key={`${ip}-${index}`}
                    className="text-[11px] leading-5 text-cyan-200 bg-slate-950 rounded-lg p-3 overflow-x-auto border border-slate-800"
                  >
                    {JSON.stringify(target, null, 2)}
                  </pre>
                ))}
                {(state.targets || []).length === 0 && (
                  <div className="text-xs text-slate-500 px-1 py-2">No targets in current frame.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-slate-200 font-mono text-right">{value}</span>
    </div>
  );
}
