import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from '../types';
import { MapPinned, LocateFixed, Compass, X } from 'lucide-react';
import { CameraGroupKey, getCameraGroupKey, normalizeDirection } from '../utils/cameraGroups';

const TILE_SIZE = 256;
const MIN_ZOOM = 12;
const MAX_ZOOM = 19;

type ProjectedPoint = { x: number; y: number };

function project(latitude: number, longitude: number, zoom: number): ProjectedPoint {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const sinLat = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function getDirectionColor(direction?: string) {
  const normalized = normalizeDirection(direction);
  if (normalized === '上行匝道') return '#f59e0b';
  if (normalized === '上行') return '#ef4444';
  if (normalized === '下行') return '#3b82f6';
  return '#22d3ee';
}

export default function GeographicMap({
  cameras,
  selectedGroup,
  onGroupChange,
  isCreatingSequenceGroup,
  draftSequenceCameraIds,
  onToggleDraftSequenceCamera,
}: {
  cameras: Camera[];
  selectedGroup: CameraGroupKey;
  onGroupChange: (group: CameraGroupKey) => void;
  isCreatingSequenceGroup: boolean;
  draftSequenceCameraIds: string[];
  onToggleDraftSequenceCamera: (cameraId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(15);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const dragState = useRef<{ active: boolean; startX: number; startY: number; centerPoint: ProjectedPoint | null }>({
    active: false,
    startX: 0,
    startY: 0,
    centerPoint: null,
  });

  const geoCameras = useMemo(
    () => cameras.filter((camera) => typeof camera.latitude === 'number' && typeof camera.longitude === 'number'),
    [cameras]
  );

  const groupedCameras = useMemo(() => {
    if (selectedGroup === 'all') return geoCameras;
    return geoCameras.filter((camera) => getCameraGroupKey(camera.direction) === selectedGroup);
  }, [geoCameras, selectedGroup]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (groupedCameras.length > 0) {
      const avgLat = groupedCameras.reduce((sum, camera) => sum + (camera.latitude || 0), 0) / groupedCameras.length;
      const avgLon = groupedCameras.reduce((sum, camera) => sum + (camera.longitude || 0), 0) / groupedCameras.length;
      setCenter({ lat: avgLat, lon: avgLon });
    }
  }, [selectedGroup, groupedCameras]);

  const centerPoint = center ? project(center.lat, center.lon, zoom) : null;

  const renderedTiles = useMemo(() => {
    if (!centerPoint || !dimensions.width || !dimensions.height) return [];
    const startX = centerPoint.x - dimensions.width / 2;
    const startY = centerPoint.y - dimensions.height / 2;
    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    const endTileX = Math.floor((centerPoint.x + dimensions.width / 2) / TILE_SIZE);
    const endTileY = Math.floor((centerPoint.y + dimensions.height / 2) / TILE_SIZE);
    const tileLimit = Math.pow(2, zoom);
    const tiles: Array<{ key: string; left: number; top: number; url: string }> = [];

    for (let tx = startTileX - 1; tx <= endTileX + 1; tx++) {
      for (let ty = startTileY - 1; ty <= endTileY + 1; ty++) {
        if (ty < 0 || ty >= tileLimit) continue;
        const wrappedX = ((tx % tileLimit) + tileLimit) % tileLimit;
        tiles.push({
          key: `${zoom}-${wrappedX}-${ty}`,
          left: tx * TILE_SIZE - startX,
          top: ty * TILE_SIZE - startY,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        });
      }
    }

    return tiles;
  }, [centerPoint, dimensions.height, dimensions.width, zoom]);

  const cameraDots = useMemo(() => {
    if (!centerPoint || !dimensions.width || !dimensions.height) return [];
    return groupedCameras.map((camera) => {
      const point = project(camera.latitude!, camera.longitude!, zoom);
      return {
        camera,
        left: point.x - centerPoint.x + dimensions.width / 2,
        top: point.y - centerPoint.y + dimensions.height / 2,
        color: getDirectionColor(camera.direction),
        order: draftSequenceCameraIds.indexOf(camera.id),
      };
    });
  }, [centerPoint, dimensions.height, dimensions.width, groupedCameras, zoom, draftSequenceCameraIds]);

  const selectedCamera = groupedCameras.find((camera) => camera.id === selectedCameraId) || null;

  const orderedGroups = useMemo(() => {
    const base = [
      { key: 'upbound' as CameraGroupKey, label: '上行', color: '#ef4444' },
      { key: 'downbound' as CameraGroupKey, label: '下行', color: '#3b82f6' },
      { key: 'ramp' as CameraGroupKey, label: '上行匝道', color: '#f59e0b' },
    ];
    return base.map((group) => ({
      ...group,
      count: geoCameras.filter((camera) => getCameraGroupKey(camera.direction) === group.key).length,
    }));
  }, [geoCameras]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (event.deltaY < 0 ? 1 : -1)));
    if (nextZoom !== zoom) setZoom(nextZoom);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!centerPoint) return;
    dragState.current = { active: true, startX: event.clientX, startY: event.clientY, centerPoint };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.active || !dragState.current.centerPoint) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    const scale = TILE_SIZE * Math.pow(2, zoom);
    const nextX = dragState.current.centerPoint.x - dx;
    const nextY = dragState.current.centerPoint.y - dy;
    const lon = (nextX / scale) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * nextY) / scale)));
    const lat = (latRad * 180) / Math.PI;
    setCenter({ lat, lon });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#04070d] cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => (dragState.current.active = false)}
      onMouseLeave={() => (dragState.current.active = false)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.25),rgba(2,6,23,0.8))] z-10 pointer-events-none" />

      <div className="absolute inset-0">
        {renderedTiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            draggable={false}
            className="absolute h-64 w-64 select-none pointer-events-none brightness-[0.26] contrast-[1.2] saturate-[0.7]"
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
      </div>

      <div className="absolute top-5 left-6 z-20 rounded-2xl border border-slate-700/70 bg-slate-900/85 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="text-lg font-semibold text-cyan-300">Geographic Camera Map</div>
        <div className="mt-1 text-xs text-slate-500">Cameras rendered from local latitude / longitude config</div>
      </div>

      <div className="absolute top-5 right-6 z-20 w-72 rounded-2xl border border-slate-700/70 bg-slate-900/88 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 text-lg font-semibold text-slate-100">图例 (Legend)</div>
        <Legend color="#22d3ee" label="相机 (Camera)" />
        {orderedGroups.map((group) => (
          <button
            key={group.key}
            onClick={() => onGroupChange(group.key)}
            className={`flex w-full items-center justify-between gap-3 py-2 text-sm ${
              selectedGroup === group.key ? 'text-white' : 'text-slate-300'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: group.color }} />
              <span>{group.label}</span>
            </span>
            <span className="text-xs text-slate-500">{group.count}</span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-5 left-6 z-20 rounded-2xl border border-slate-700/70 bg-slate-900/85 px-4 py-3 shadow-2xl backdrop-blur-xl text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-cyan-300" />
          <span>{groupedCameras.length} cameras in current group</span>
        </div>
        <div className="mt-1 text-slate-500">
          {isCreatingSequenceGroup ? 'Click cameras to assign order' : 'Scroll to zoom, drag to pan'}
        </div>
      </div>

      {cameraDots.map(({ camera, left, top, color, order }) => {
        const isSelected = camera.id === selectedCameraId;
        const isOrdered = order >= 0;
        return (
          <button
            key={camera.id}
            onClick={(event) => {
              event.stopPropagation();
              if (isCreatingSequenceGroup) {
                onToggleDraftSequenceCamera(camera.id);
              } else {
                setSelectedCameraId(camera.id);
              }
            }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left, top }}
          >
            <span
              className="flex items-center justify-center rounded-full border-2 border-white/60 text-[10px] font-bold text-white"
              style={{
                width: isSelected || isOrdered ? 22 : 14,
                height: isSelected || isOrdered ? 22 : 14,
                backgroundColor: color,
                boxShadow: `0 0 20px ${color}66`,
              }}
            >
              {isOrdered ? order + 1 : ''}
            </span>
          </button>
        );
      })}

      {selectedCamera && !isCreatingSequenceGroup && (
        <div className="absolute z-30 top-1/4 left-1/2 -translate-x-1/2 rounded-3xl border border-slate-200/10 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] text-slate-800 min-w-72">
          <button onClick={() => setSelectedCameraId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
          <div className="text-2xl font-semibold tracking-tight">{selectedCamera.id}</div>
          <div className="mt-5 space-y-3 text-sm">
            <InfoRow label="方向" value={normalizeDirection(selectedCamera.direction) || '-'} />
            <InfoRow label="纬度" value={selectedCamera.latitude?.toFixed(6) || '-'} />
            <InfoRow label="经度" value={selectedCamera.longitude?.toFixed(6) || '-'} />
            <InfoRow label="航向" value={selectedCamera.heading ? `${selectedCamera.heading.toFixed(0)}°` : '-'} />
            <InfoRow label="状态" value={selectedCamera.connected ? '在线' : '离线'} />
            <InfoRow label="目标数" value={`${selectedCamera.targetCount ?? 0}`} />
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-3 z-20 text-[11px] text-slate-500">Map tiles © OpenStreetMap contributors</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-slate-300">
      <span className="block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-16 items-center gap-2 text-slate-500">
        {label === '航向' ? <Compass className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
        <span>{label}</span>
      </div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}
