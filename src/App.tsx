/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import MapViewer from './components/MapViewer';
import Sidebar from './components/Sidebar';
import Minimap from './components/Minimap';
import { Car, Camera } from './types';
import { Car as CarIcon, Gauge, MapPin, Navigation } from 'lucide-react';

export default function App() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [hideAtNextCamera, setHideAtNextCamera] = useState(false);

  // Viewport state
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(200);
  const [scale, setScale] = useState(1);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth - 256); // 256 is sidebar width

  const wsRef = useRef<WebSocket | null>(null);

  const selectedCar = cars.find(c => c.id === selectedCarId) || null;
  const roadLength = cameras.length > 0 ? Math.max(...cameras.map(c => c.x)) + 1000 : 10000;

  const visibleCars = React.useMemo(() => {
    if (!hideAtNextCamera) return cars;

    const sortedCameras = [...cameras].sort((a, b) => a.x - b.x);
    const nextCameraXMap = new Map<string, number>();
    
    for (let i = 0; i < sortedCameras.length; i++) {
      const cam = sortedCameras[i];
      const nextCam = sortedCameras[i + 1];
      if (nextCam) {
        nextCameraXMap.set(cam.id, nextCam.x);
      } else {
        nextCameraXMap.set(cam.id, Infinity);
      }
    }

    return cars.filter(car => {
      if (!car.cameraId) return true;
      const nextX = nextCameraXMap.get(car.cameraId);
      if (nextX !== undefined && car.x >= nextX) {
        return false;
      }
      return true;
    });
  }, [cars, cameras, hideAtNextCamera]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth - 256);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to backend');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INIT') {
          setCameras(data.cameras);
        } else if (data.type === 'CARS_UPDATE') {
          setCars(data.cars);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Sync viewport to server
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const PIXELS_PER_METER = 0.5;
      const START_OFFSET = 150;
      const visualStartX = -positionX / scale;
      const visualEndX = (screenWidth - positionX) / scale;
      
      const realStartX = (visualStartX - START_OFFSET) / PIXELS_PER_METER;
      const realEndX = (visualEndX - START_OFFSET) / PIXELS_PER_METER;

      wsRef.current.send(JSON.stringify({
        type: 'SET_VIEWPORT',
        startX: realStartX,
        endX: realEndX
      }));
    }
  }, [positionX, scale, screenWidth]);

  const handleSelectCamera = (camX: number) => {
    // Center the camera on screen
    const PIXELS_PER_METER = 0.5;
    const START_OFFSET = 150;
    const visualX = START_OFFSET + camX * PIXELS_PER_METER;
    setPositionX(screenWidth / 2 - visualX * scale);
  };

  const handleDeleteCamera = (id: string) => {
    // Optional: implement delete logic if needed
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <Sidebar
        cameras={cameras}
        onSelectCamera={handleSelectCamera}
        hideAtNextCamera={hideAtNextCamera}
        onToggleHideAtNextCamera={() => setHideAtNextCamera(!hideAtNextCamera)}
      />
      
      <div className="flex-1 flex flex-col relative">
        <main className="flex-1 relative overflow-hidden bg-slate-950">
          <MapViewer
            cameras={cameras}
            cars={visibleCars}
            roadLength={roadLength}
            positionX={positionX}
            positionY={positionY}
            scale={scale}
            onPositionChange={(x, y) => { setPositionX(x); setPositionY(y); }}
            onScaleChange={setScale}
            onCameraMove={(id, newX) => {
              // Optional: implement move logic if needed
            }}
            onDeleteCamera={handleDeleteCamera}
            onCarClick={(car) => setSelectedCarId(car.id)}
            onBgClick={() => setSelectedCarId(null)}
          />
          
          {selectedCar && (
            <div className="absolute bottom-6 right-6 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-2xl w-72 backdrop-blur-xl pointer-events-auto transform transition-all duration-300 ease-out">
              <div className="flex items-center space-x-3 mb-4 border-b border-slate-700/50 pb-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <CarIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Vehicle Details</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedCar.id}</p>
                </div>
                <div className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Position</span>
                  </div>
                  <span className="font-mono text-sm text-slate-200">{(selectedCar.x / 1000).toFixed(2)} km</span>
                </div>
                
                <div className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Navigation className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Lane</span>
                  </div>
                  <span className="font-mono text-sm text-slate-200">{selectedCar.lane}</span>
                </div>
                
                <div className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Gauge className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Speed</span>
                  </div>
                  <span className="font-mono text-sm text-cyan-400">{Math.round(selectedCar.speed)} km/h</span>
                </div>
              </div>
            </div>
          )}
        </main>
        
        <Minimap
          cameras={cameras}
          positionX={positionX}
          scale={scale}
          screenWidth={screenWidth}
          onPositionXChange={setPositionX}
        />
      </div>
    </div>
  );
}

