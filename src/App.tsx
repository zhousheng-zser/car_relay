/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import MapViewer from './components/MapViewer';
import Sidebar from './components/Sidebar';
import Minimap from './components/Minimap';
import DebugPanel from './components/DebugPanel';
import GeographicMap from './components/GeographicMap';
import { Car, Camera, CameraSequenceGroup } from './types';
import { Car as CarIcon, Gauge, MapPin, Navigation, Radar, Clock3, Route, Monitor, Map as MapIcon } from 'lucide-react';
import { CameraGroupKey, filterCamerasByGroup } from './utils/cameraGroups';

export default function App() {
  const sidebarWidth = 288;
  const apiPrefix = '/relay-api';
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [hideAtNextCamera, setHideAtNextCamera] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);
  const [debugOpen, setDebugOpen] = useState(true);
  const [debugSnapshot, setDebugSnapshot] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'simulation' | 'geographic'>('simulation');
  const [selectedGroup, setSelectedGroup] = useState<CameraGroupKey>('all');
  const [cameraSequenceGroups, setCameraSequenceGroups] = useState<CameraSequenceGroup[]>([]);
  const [selectedSequenceGroupId, setSelectedSequenceGroupId] = useState<string>('all');
  const [isCreatingSequenceGroup, setIsCreatingSequenceGroup] = useState(false);
  const [draftSequenceGroupName, setDraftSequenceGroupName] = useState('');
  const [draftSequenceCameraIds, setDraftSequenceCameraIds] = useState<string[]>([]);

  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(200);
  const [scale, setScale] = useState(1);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth - sidebarWidth);

  const wsRef = useRef<WebSocket | null>(null);

  const selectedCar = cars.find((c) => c.id === selectedCarId) || null;
  const selectedCamera = selectedCar?.cameraId
    ? cameras.find((camera) => camera.id === selectedCar.cameraId) || null
    : null;
  const groupedCameras = React.useMemo(() => filterCamerasByGroup(cameras, selectedGroup), [cameras, selectedGroup]);
  const selectedSequenceGroup = React.useMemo(
    () => cameraSequenceGroups.find((group) => group.id === selectedSequenceGroupId) || null,
    [cameraSequenceGroups, selectedSequenceGroupId]
  );
  const sequenceFilteredCameras = React.useMemo(() => {
    if (!selectedSequenceGroup || selectedSequenceGroupId === 'all') {
      return groupedCameras;
    }
    const orderMap = new Map(selectedSequenceGroup.cameraIds.map((id, index) => [id, index]));
    return groupedCameras
      .filter((camera) => orderMap.has(camera.id))
      .sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
  }, [groupedCameras, selectedSequenceGroup, selectedSequenceGroupId]);
  const groupedCameraIds = React.useMemo(() => new Set(sequenceFilteredCameras.map((camera) => camera.id)), [sequenceFilteredCameras]);
  const groupedCars = React.useMemo(() => cars.filter((car) => !car.cameraId || groupedCameraIds.has(car.cameraId)), [cars, groupedCameraIds]);
  const roadLength = sequenceFilteredCameras.length > 0 ? Math.max(...sequenceFilteredCameras.map((c) => c.x)) + 1000 : 10000;
  const connectedCameraCount = cameras.filter((camera) => camera.connected).length;

  const visibleCars = React.useMemo(() => {
    if (!hideAtNextCamera) return groupedCars;

    const sortedCameras = [...sequenceFilteredCameras].sort((a, b) => a.x - b.x);
    const nextCameraXMap = new Map<string, number>();

    for (let i = 0; i < sortedCameras.length; i++) {
      const cam = sortedCameras[i];
      const nextCam = sortedCameras[i + 1];
      nextCameraXMap.set(cam.id, nextCam ? nextCam.x : Infinity);
    }

    return cars.filter((car) => {
      if (!car.cameraId) return true;
      const nextX = nextCameraXMap.get(car.cameraId);
      return nextX === undefined || car.x < nextX;
    });
  }, [groupedCars, sequenceFilteredCameras, hideAtNextCamera]);

  useEffect(() => {
    if (selectedGroup === 'all') return;
    const groupsInDirection = cameraSequenceGroups.filter((group) => {
      if (selectedGroup === 'upbound') return group.direction === '上行';
      if (selectedGroup === 'downbound') return group.direction === '下行';
      if (selectedGroup === 'ramp') return group.direction === '上行匝道';
      return true;
    });
    if (selectedSequenceGroupId !== 'all' && !groupsInDirection.some((group) => group.id === selectedSequenceGroupId)) {
      setSelectedSequenceGroupId('all');
    }
  }, [selectedGroup, cameraSequenceGroups, selectedSequenceGroupId]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth - sidebarWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarWidth]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INIT') {
          setCameras(data.cameras || []);
        } else if (data.type === 'CARS_UPDATE') {
          setCars(data.cars || []);
        } else if (data.type === 'DEBUG_UPDATE') {
          setDebugSnapshot(data.debug || null);
        }
      } catch (error) {
        console.error('Failed to parse WS message', error);
      }
    };

    ws.onopen = () => setStatusMessage('Backend connected');
    ws.onclose = () => setStatusMessage('Backend disconnected');

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const pixelsPerMeter = 0.5;
      const startOffset = 150;
      const visualStartX = -positionX / scale;
      const visualEndX = (screenWidth - positionX) / scale;

      const realStartX = (visualStartX - startOffset) / pixelsPerMeter;
      const realEndX = (visualEndX - startOffset) / pixelsPerMeter;

      wsRef.current.send(
        JSON.stringify({
          type: 'SET_VIEWPORT',
          startX: realStartX,
          endX: realEndX,
        })
      );
    }
  }, [positionX, scale, screenWidth]);

  const handleSelectCamera = (camX: number) => {
    const pixelsPerMeter = 0.5;
    const startOffset = 150;
    const visualX = startOffset + camX * pixelsPerMeter;
    setPositionX(screenWidth / 2 - visualX * scale);
  };

  const handleDeleteCamera = (_id: string) => {
    setStatusMessage('Remote remove is available from the backend API when needed');
  };

  const callCameraAction = async (endpoint: string, successMessage: string) => {
    setIsBusy(true);
    try {
      const response = await fetch(`${apiPrefix}${endpoint}`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || 'Request failed');
      }

      if (Array.isArray(result.data)) {
        setCameras(result.data);
      } else if (Array.isArray(result.data?.data)) {
        setCameras(result.data.data);
      }

      setStatusMessage(successMessage);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setIsBusy(false);
    }
  };

  const currentDirectionLabel =
    selectedGroup === 'upbound' ? '上行' : selectedGroup === 'downbound' ? '下行' : selectedGroup === 'ramp' ? '上行匝道' : '全部';

  const toggleDraftSequenceCamera = (cameraId: string) => {
    setDraftSequenceCameraIds((current) => {
      if (current.includes(cameraId)) {
        return current.filter((id) => id !== cameraId);
      }
      return [...current, cameraId];
    });
  };

  const saveDraftSequenceGroup = () => {
    if (!draftSequenceGroupName.trim() || draftSequenceCameraIds.length === 0 || currentDirectionLabel === '全部') {
      return;
    }
    const nextGroup = {
      id: `group-${Date.now()}`,
      name: draftSequenceGroupName.trim(),
      direction: currentDirectionLabel,
      cameraIds: draftSequenceCameraIds,
    };
    setCameraSequenceGroups((current) => [...current, nextGroup]);
    setSelectedSequenceGroupId(nextGroup.id);
    setDraftSequenceGroupName('');
    setDraftSequenceCameraIds([]);
    setIsCreatingSequenceGroup(false);
    setStatusMessage(`Saved group: ${nextGroup.name}`);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <Sidebar
        cameras={groupedCameras}
        onSelectCamera={handleSelectCamera}
        hideAtNextCamera={hideAtNextCamera}
        onToggleHideAtNextCamera={() => setHideAtNextCamera(!hideAtNextCamera)}
        statusMessage={statusMessage}
        isBusy={isBusy}
        onSyncRemote={() => callCameraAction('/cameras/sync-remote', 'Remote collector synced')}
        onReloadConfig={() => callCameraAction('/cameras/reload-config', 'Camera config reloaded')}
        connectedCameraCount={connectedCameraCount}
        carCount={cars.length}
        selectedGroup={selectedGroup}
        onGroupChange={(group) => {
          setSelectedGroup(group);
          setSelectedSequenceGroupId('all');
          setDraftSequenceCameraIds([]);
          setIsCreatingSequenceGroup(false);
        }}
        cameraSequenceGroups={cameraSequenceGroups}
        selectedSequenceGroupId={selectedSequenceGroupId}
        onSelectSequenceGroup={setSelectedSequenceGroupId}
        onDeleteSequenceGroup={(groupId) => {
          setCameraSequenceGroups((current) => current.filter((group) => group.id !== groupId));
          if (selectedSequenceGroupId === groupId) {
            setSelectedSequenceGroupId('all');
          }
          setStatusMessage('Group deleted');
        }}
        isCreatingSequenceGroup={isCreatingSequenceGroup}
        onStartCreateSequenceGroup={() => {
          setIsCreatingSequenceGroup(true);
          setDraftSequenceCameraIds([]);
          setDraftSequenceGroupName('');
          setSelectedSequenceGroupId('all');
        }}
        onCancelCreateSequenceGroup={() => {
          setIsCreatingSequenceGroup(false);
          setDraftSequenceCameraIds([]);
          setDraftSequenceGroupName('');
        }}
        draftSequenceGroupName={draftSequenceGroupName}
        onDraftSequenceGroupNameChange={setDraftSequenceGroupName}
        draftSequenceCameraIds={draftSequenceCameraIds}
        onSaveSequenceGroup={saveDraftSequenceGroup}
      />

      <div className="flex-1 flex flex-col relative">
        <main className="flex-1 relative overflow-hidden bg-slate-950">
          <DebugPanel debug={debugSnapshot} isOpen={debugOpen} onToggle={() => setDebugOpen(!debugOpen)} />

          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/85 p-2 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setViewMode('simulation')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'simulation'
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Simulation
            </button>
            <button
              onClick={() => setViewMode('geographic')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'geographic'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              Geographic Map
            </button>
          </div>

          {viewMode === 'simulation' ? (
            <MapViewer
              cameras={sequenceFilteredCameras}
              cars={visibleCars}
              roadLength={roadLength}
              positionX={positionX}
              positionY={positionY}
              scale={scale}
              onPositionChange={(x, y) => {
                setPositionX(x);
                setPositionY(y);
              }}
              onScaleChange={setScale}
              onCameraMove={() => {}}
              onDeleteCamera={handleDeleteCamera}
              onCarClick={(car) => setSelectedCarId(car.id)}
              onBgClick={() => setSelectedCarId(null)}
            />
          ) : (
            <GeographicMap
              cameras={cameras}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              isCreatingSequenceGroup={isCreatingSequenceGroup}
              draftSequenceCameraIds={draftSequenceCameraIds}
              onToggleDraftSequenceCamera={toggleDraftSequenceCamera}
            />
          )}

          {selectedCar && (
            <div className="absolute bottom-6 right-6 rounded-2xl border border-slate-700/50 bg-slate-900/85 p-5 shadow-2xl w-80 backdrop-blur-xl pointer-events-auto">
              <div className="flex items-center space-x-3 mb-4 border-b border-slate-700/50 pb-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <CarIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Radar Target</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedCar.id}</p>
                </div>
                <div className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Metric icon={<MapPin className="w-4 h-4" />} label="Road Pos" value={`${(selectedCar.x / 1000).toFixed(2)} km`} />
                  <Metric icon={<Navigation className="w-4 h-4" />} label="Lane" value={`${selectedCar.lane}`} />
                  <Metric icon={<Gauge className="w-4 h-4" />} label="Speed" value={`${Math.round(selectedCar.speed)} km/h`} accent />
                  <Metric icon={<Radar className="w-4 h-4" />} label="Camera" value={selectedCar.cameraId || '-'} />
                </div>

                <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 uppercase tracking-wider">Source Target</span>
                    <span className="font-mono text-slate-200">{selectedCar.sourceTargetId ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 uppercase tracking-wider">Union ID</span>
                    <span className="font-mono text-slate-200">{selectedCar.unionId ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 uppercase tracking-wider">Direction</span>
                    <span className="font-mono text-slate-200">{selectedCar.direction || selectedCamera?.direction || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 uppercase tracking-wider">Last Update</span>
                    <span className="font-mono text-slate-200">
                      {selectedCar.lastUpdate ? new Date(selectedCar.lastUpdate).toLocaleTimeString() : '-'}
                    </span>
                  </div>
                </div>

                {selectedCamera && (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                      <Route className="w-4 h-4 text-indigo-400" />
                      Camera Context
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Heading</span>
                      <span className="font-mono text-slate-200">{selectedCamera.heading?.toFixed(1) ?? '-'} deg</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Targets</span>
                      <span className="font-mono text-slate-200">{selectedCamera.targetCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Collector Update</span>
                      <span className="font-mono text-slate-200">{selectedCamera.lastUpdate || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedCar && (
            <div className="absolute top-6 right-6 rounded-2xl border border-slate-800/60 bg-slate-900/70 px-4 py-3 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <Radar className="w-4 h-4 text-cyan-400" />
                <span>{cars.length} live targets</span>
                <Clock3 className="w-4 h-4 text-indigo-400" />
                <span>{connectedCameraCount}/{cameras.length} cameras connected</span>
              </div>
            </div>
          )}
        </main>

        {viewMode === 'simulation' && (
          <Minimap
            cameras={sequenceFilteredCameras}
            positionX={positionX}
            scale={scale}
            screenWidth={screenWidth}
            onPositionXChange={setPositionX}
          />
        )}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
      <div className="flex items-center space-x-2 text-slate-400 mb-1">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-mono text-sm ${accent ? 'text-cyan-400' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}
