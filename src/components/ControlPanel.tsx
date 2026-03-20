import React, { useState, useRef, useEffect } from 'react';
import { Plus, Video, ChevronDown, ChevronUp, Trash2, Eye, EyeOff } from 'lucide-react';
import { Camera } from '../types';

interface ControlPanelProps {
  cameras: Camera[];
  onAddCamera: () => void;
  onUpdateCamera: (id: string, newX: number) => void;
  onDeleteCamera: (id: string) => void;
  hideAtNextCamera: boolean;
  onToggleHideAtNextCamera: () => void;
}

export default function ControlPanel({ cameras, onAddCamera, onUpdateCamera, onDeleteCamera, hideAtNextCamera, onToggleHideAtNextCamera }: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center space-x-4" ref={dropdownRef}>
      <button
        onClick={onToggleHideAtNextCamera}
        className={`flex items-center space-x-2 px-3 py-2 rounded-xl border transition-all shadow-lg backdrop-blur-md ${
          hideAtNextCamera 
            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
            : 'bg-slate-900/80 border-slate-700/50 text-slate-400 hover:bg-slate-800/80'
        }`}
        title={hideAtNextCamera ? "Cars disappear at next camera" : "Cars continue past next camera"}
      >
        {hideAtNextCamera ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {hideAtNextCamera ? 'Hide at Next Cam' : 'Show Past Next Cam'}
        </span>
      </button>

      <div className="flex items-center space-x-4 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-700/50 shadow-lg backdrop-blur-md">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 hover:bg-slate-800/50 px-2 py-1 rounded-lg transition-colors"
        >
          <Video className="w-4 h-4 text-slate-400" />
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest cursor-pointer">
            Cameras: <span className="text-indigo-400 ml-1">{cameras.length}</span>
          </label>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        <div className="w-px h-4 bg-slate-700 mx-2"></div>
        <button
          onClick={onAddCamera}
          className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Camera</span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl backdrop-blur-xl z-50 max-h-96 overflow-y-auto p-2">
          <div className="space-y-2">
            {cameras.map((cam) => (
              <div key={cam.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span className="text-slate-400 font-mono text-sm w-16 truncate" title={cam.id.replace('cam-', '')}>
                  {cam.id.replace('cam-', '')}
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={cam.x / 1000}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        onUpdateCamera(cam.id, val * 1000);
                      }
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-500 text-sm">km</span>
                </div>
                <button
                  onClick={() => onDeleteCamera(cam.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

