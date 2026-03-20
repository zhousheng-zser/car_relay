import React, { useRef, useState } from 'react';
import { Camera } from '../types';

interface MinimapProps {
  cameras: Camera[];
  positionX: number;
  scale: number;
  screenWidth: number;
  onPositionXChange: (x: number) => void;
}

export default function Minimap({ cameras, positionX, scale, screenWidth, onPositionXChange }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const maxCamX = cameras.length > 0 ? Math.max(...cameras.map(c => c.x)) : 10000;
  const totalLength = maxCamX + 2000; // Add some buffer at the end

  const PIXELS_PER_METER = 0.5;
  const START_OFFSET = 150;

  const visualStartX = -positionX / scale;
  const visualEndX = (screenWidth - positionX) / scale;
  
  const realStartX = (visualStartX - START_OFFSET) / PIXELS_PER_METER;
  const realEndX = (visualEndX - START_OFFSET) / PIXELS_PER_METER;
  
  const clampedStartX = Math.max(0, realStartX);
  const clampedEndX = Math.min(totalLength, realEndX);
  const clampedWidth = Math.max(0, clampedEndX - clampedStartX);

  const handleInteraction = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetCenterRealX = ratio * totalLength;

    // We want targetCenterRealX to be in the middle of the screen
    const visualCenter = START_OFFSET + targetCenterRealX * PIXELS_PER_METER;
    const newPositionX = screenWidth / 2 - visualCenter * scale;
    onPositionXChange(newPositionX);
  };

  return (
    <div className="h-28 bg-slate-900 border-t border-slate-800 p-4 flex flex-col justify-center select-none z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="text-xs text-slate-500 mb-3 font-mono flex justify-between items-center px-2">
        <span>0.0km</span>
        <span className="text-slate-400 font-semibold uppercase tracking-widest">Global Route Map</span>
        <span>{(totalLength / 1000).toFixed(1)}km</span>
      </div>
      <div
        ref={containerRef}
        className="relative h-10 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer overflow-hidden group hover:border-slate-700 transition-colors"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleInteraction(e.clientX);
        }}
        onMouseMove={(e) => {
          if (isDragging) handleInteraction(e.clientX);
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        {/* Track Line */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-slate-800 group-hover:bg-slate-700 transition-colors" />

        {/* Cameras */}
        {cameras.map(cam => (
          <div
            key={cam.id}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-500/50 rounded-full"
            style={{ left: `${(cam.x / totalLength) * 100}%` }}
          />
        ))}

        {/* Viewport Box */}
        <div
          className="absolute top-0 h-full bg-indigo-500/20 border-x-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] pointer-events-none"
          style={{
            left: `${(clampedStartX / totalLength) * 100}%`,
            width: `${(clampedWidth / totalLength) * 100}%`
          }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-indigo-400 rounded-full" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-indigo-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
