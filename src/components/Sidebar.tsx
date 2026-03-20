import React, { useMemo, useState } from 'react';
import { Search, Video, Radio, Activity, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { Camera, CameraSequenceGroup } from '../types';
import { CameraGroupKey } from '../utils/cameraGroups';

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
  selectedGroup: CameraGroupKey;
  onGroupChange: (group: CameraGroupKey) => void;
  cameraSequenceGroups: CameraSequenceGroup[];
  selectedSequenceGroupId: string;
  onSelectSequenceGroup: (groupId: string) => void;
  onDeleteSequenceGroup: (groupId: string) => void;
  isCreatingSequenceGroup: boolean;
  onStartCreateSequenceGroup: () => void;
  onCancelCreateSequenceGroup: () => void;
  draftSequenceGroupName: string;
  onDraftSequenceGroupNameChange: (value: string) => void;
  draftSequenceCameraIds: string[];
  onSaveSequenceGroup: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const {
    cameras,
    statusMessage,
    connectedCameraCount,
    carCount,
    cameraSequenceGroups,
    selectedSequenceGroupId,
    onSelectSequenceGroup,
    onDeleteSequenceGroup,
    isCreatingSequenceGroup,
    onStartCreateSequenceGroup,
    onCancelCreateSequenceGroup,
    draftSequenceGroupName,
    onDraftSequenceGroupNameChange,
    draftSequenceCameraIds,
    onSaveSequenceGroup,
  } = props;

  const [search, setSearch] = useState('');
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<CameraSequenceGroup | null>(null);
  const filtered = cameras.filter((camera) => camera.id.toLowerCase().includes(search.toLowerCase()));
  const visibleGroups = useMemo(() => cameraSequenceGroups, [cameraSequenceGroups]);

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

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400 min-h-10">
          {statusMessage || 'Waiting for backend activity...'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-200">
              <FolderKanban className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold">分组</span>
            </div>
            <button
              onClick={onStartCreateSequenceGroup}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {visibleGroups.map((group) => (
              <div
                key={group.id}
                className={`w-full rounded-lg border px-3 py-2 ${
                  selectedSequenceGroupId === group.id
                    ? 'border-cyan-500/40 bg-cyan-500/12'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => onSelectSequenceGroup(group.id)} className="flex-1 text-left">
                    <div className="text-sm font-semibold text-slate-100 leading-5">{group.name}</div>
                    <div className="text-[11px] text-slate-500">{group.direction} · {group.cameraIds.length} cameras</div>
                  </button>
                  <button
                    onClick={() => setPendingDeleteGroup(group)}
                    className="rounded-md p-1 text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete group"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {visibleGroups.length === 0 && <div className="text-xs text-slate-500 py-2">还没有分组。</div>}
          </div>
        </div>

        {isCreatingSequenceGroup ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
            <div className="text-sm font-semibold text-slate-200">新建分组</div>
            <input
              type="text"
              value={draftSequenceGroupName}
              onChange={(e) => onDraftSequenceGroupNameChange(e.target.value)}
              placeholder="输入分组名称"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-[11px] text-slate-500 mb-2">当前顺序</div>
              <div className="flex flex-wrap gap-2">
                {draftSequenceCameraIds.map((id, index) => (
                  <span key={id} className="rounded-full bg-cyan-500/12 border border-cyan-500/20 px-2 py-1 text-[11px] text-cyan-300">
                    {index + 1}. {id}
                  </span>
                ))}
                {draftSequenceCameraIds.length === 0 && <span className="text-[11px] text-slate-500">请在地图上逐个点击相机</span>}
              </div>
            </div>

            <div className="text-[11px] text-slate-500">建组模式已开启。请在地图上逐个点击相机，系统会按点击顺序编号。</div>

            <div className="flex gap-2">
              <button
                onClick={onSaveSequenceGroup}
                className="flex-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-3 py-2 text-sm font-semibold text-cyan-300"
              >
                保存分组
              </button>
              <button
                onClick={onCancelCreateSequenceGroup}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
            点击上方 <span className="text-slate-300">+</span> 新建分组，然后在地图上一个一个点选相机。
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
          当前可选相机数: {filtered.length}
        </div>
      </div>

      {pendingDeleteGroup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5">
            <div className="text-lg font-semibold text-slate-100">删除分组</div>
            <div className="mt-3 text-sm text-slate-400 leading-6">
              确定要删除分组 <span className="text-slate-100 font-medium">{pendingDeleteGroup.name}</span> 吗？
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  onDeleteSequenceGroup(pendingDeleteGroup.id);
                  setPendingDeleteGroup(null);
                }}
                className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300"
              >
                确认删除
              </button>
              <button
                onClick={() => setPendingDeleteGroup(null)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
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
