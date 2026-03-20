import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Text, Group, Path, Circle } from 'react-konva';
import { Car, Camera } from '../types';

interface MapViewerProps {
  cameras: Camera[];
  cars: Car[];
  roadLength: number;
  positionX: number;
  positionY: number;
  scale: number;
  onPositionChange: (x: number, y: number) => void;
  onScaleChange: (scale: number) => void;
  onCameraMove: (id: string, newX: number) => void;
  onDeleteCamera: (id: string) => void;
  onCarClick: (car: Car) => void;
  onBgClick: () => void;
}

const LANE_HEIGHT = 40;
const NUM_LANES = 4;
const ROAD_HEIGHT = LANE_HEIGHT * NUM_LANES;

const CAR_PALETTE = [
  { hex: '#06b6d4', rgb: '6, 182, 212' },   // cyan-500
  { hex: '#0ea5e9', rgb: '14, 165, 233' },  // sky-500
  { hex: '#3b82f6', rgb: '59, 130, 246' },  // blue-500
  { hex: '#14b8a6', rgb: '20, 184, 166' },  // teal-500
  { hex: '#8b5cf6', rgb: '139, 92, 246' },  // violet-500
];

export default function MapViewer({
  cameras,
  cars,
  roadLength,
  positionX,
  positionY,
  scale,
  onPositionChange,
  onScaleChange,
  onCameraMove,
  onDeleteCamera,
  onCarClick,
  onBgClick,
}: MapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const carVisuals = useRef<Record<string, { y: number }>>({});
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const cameraColorMap = useMemo(() => {
    const sorted = [...cameras].sort((a, b) => a.x - b.x);
    const map = new Map<string, typeof CAR_PALETTE[0]>();
    sorted.forEach((cam, index) => {
      map.set(cam.id, CAR_PALETTE[index % CAR_PALETTE.length]);
    });
    return map;
  }, [cameras]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { getVisualX, getRealX, visualCameras, totalVisualLength } = useMemo(() => {
    if (cameras.length === 0) {
      return {
        getVisualX: (x: number) => x,
        getRealX: (vx: number) => vx,
        visualCameras: [],
        totalVisualLength: roadLength
      };
    }

    // Linear scale: 1 meter = 0.5 pixels (so 1km = 500 pixels)
    const PIXELS_PER_METER = 0.5;
    const START_OFFSET = 150;

    const getVisualX = (realX: number) => START_OFFSET + realX * PIXELS_PER_METER;
    const getRealX = (visualX: number) => (visualX - START_OFFSET) / PIXELS_PER_METER;

    const visualCameras = cameras.map(cam => ({
      ...cam,
      vx: getVisualX(cam.x)
    }));

    return {
      getVisualX,
      getRealX,
      visualCameras,
      totalVisualLength: getVisualX(roadLength) + 150,
    };
  }, [cameras, roadLength]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // Limit scale
    if (newScale < 0.3 || newScale > 10) return;

    onScaleChange(newScale);
    onPositionChange(
      -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
    );
  };

  // Generate ruler ticks
  const ticks = [];
  for (let i = 0; i <= roadLength; i += 100) {
    ticks.push(i);
  }

  // Camera SVG Path (simplified)
  const cameraPath = "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";

  return (
    <div ref={containerRef} className="h-full w-full bg-[#020617] cursor-grab active:cursor-grabbing relative">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={positionX}
        y={positionY}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            onPositionChange(e.target.x(), e.target.y());
          }
        }}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === e.target.getStage() || e.target.name() === 'bg') {
            onBgClick();
          }
        }}
      >
        <Layer>
          {/* Background to catch clicks */}
          <Rect
            x={-10000}
            y={-10000}
            width={30000}
            height={30000}
            fill="transparent"
            name="bg"
          />

          {/* Road Background */}
          <Rect
            x={0}
            y={0}
            width={totalVisualLength}
            height={ROAD_HEIGHT}
            fill="#0f172a" // slate-900
          />

          {/* Lane Dividers */}
          {[1, 2, 3].map((lane) => (
            <Line
              key={lane}
              points={[0, lane * LANE_HEIGHT, totalVisualLength, lane * LANE_HEIGHT]}
              stroke="#334155" // slate-700
              strokeWidth={2}
              dash={[15, 15]}
            />
          ))}

          {/* Road Borders */}
          <Line
            points={[0, 0, totalVisualLength, 0]}
            stroke="#475569" // slate-600
            strokeWidth={3}
          />
          <Line
            points={[0, ROAD_HEIGHT, totalVisualLength, ROAD_HEIGHT]}
            stroke="#475569" // slate-600
            strokeWidth={3}
          />

          {/* Schematic Dimension Lines */}
          <Group y={-40}>
            {visualCameras.map((cam, i) => {
              if (i === visualCameras.length - 1) return null;
              const nextCam = visualCameras[i + 1];
              const midX = (cam.vx + nextCam.vx) / 2;
              const distance = Math.round(nextCam.x - cam.x);

              return (
                <Group key={`dim-${cam.id}`}>
                  <Line points={[cam.vx + 20, 0, nextCam.vx - 20, 0]} stroke="#475569" strokeWidth={1} />
                  <Line points={[cam.vx + 25, -3, cam.vx + 20, 0, cam.vx + 25, 3]} stroke="#475569" strokeWidth={1} />
                  <Line points={[nextCam.vx - 25, -3, nextCam.vx - 20, 0, nextCam.vx - 25, 3]} stroke="#475569" strokeWidth={1} />
                  <Text
                    x={midX - 40}
                    y={-15}
                    text={`${(distance / 1000).toFixed(1)}km`}
                    fontSize={12}
                    fontFamily="JetBrains Mono"
                    fill="#94a3b8"
                    align="center"
                    width={80}
                  />
                </Group>
              );
            })}
          </Group>

          {/* Cameras */}
          {visualCameras.map((cam) => (
            <Group
              key={cam.id}
              x={cam.vx}
              y={-60}
              draggable
              dragBoundFunc={function (this: any, pos) {
                return {
                  x: pos.x,
                  y: this.absolutePosition().y,
                };
              }}
              onDragMove={(e) => {
                onCameraMove(cam.id, getRealX(e.target.x()));
              }}
              onDragEnd={(e) => {
                onCameraMove(cam.id, getRealX(e.target.x()));
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'ew-resize';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
              }}
            >
              <Line points={[0, 0, 0, 60]} stroke="#f43f5e" strokeWidth={2} dash={[4, 4]} opacity={0.6} />
              <Path
                x={-12}
                y={-24}
                data={cameraPath}
                fill="#f43f5e"
                scaleX={1}
                scaleY={1}
                shadowColor="#f43f5e"
                shadowBlur={10}
                shadowOpacity={0.6}
              />
              <Text
                x={-40}
                y={-40}
                text={`Cam: ${(cam.x / 1000).toFixed(1)}km`}
                fontSize={11}
                fontFamily="JetBrains Mono"
                fill="#f43f5e"
                align="center"
                width={80}
              />
              
              {/* Delete Button */}
              <Group
                x={12}
                y={-30}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onDeleteCamera(cam.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onDeleteCamera(cam.id);
                }}
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'ew-resize';
                }}
              >
                <Circle radius={7} fill="#ef4444" shadowColor="#ef4444" shadowBlur={4} />
                <Line points={[-2.5, -2.5, 2.5, 2.5]} stroke="#ffffff" strokeWidth={1.5} />
                <Line points={[-2.5, 2.5, 2.5, -2.5]} stroke="#ffffff" strokeWidth={1.5} />
              </Group>
            </Group>
          ))}

          {/* Cars */}
          {cars.map((car) => {
            const targetY = (car.lane - 1) * LANE_HEIGHT + LANE_HEIGHT / 2;
            if (!carVisuals.current[car.id]) {
              carVisuals.current[car.id] = { y: targetY };
            } else {
              carVisuals.current[car.id].y += (targetY - carVisuals.current[car.id].y) * 0.1;
            }
            const carY = carVisuals.current[car.id].y;
            const carPalette = car.cameraId ? cameraColorMap.get(car.cameraId) || CAR_PALETTE[0] : CAR_PALETTE[0];

            return (
              <Group
                key={car.id}
                x={getVisualX(car.x)}
                y={carY}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onCarClick(car);
                }}
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'grab';
                }}
              >
                {/* Car Body */}
                <Rect
                  x={-15}
                  y={-10}
                  width={30}
                  height={20}
                  fill={carPalette.hex}
                  cornerRadius={4}
                  shadowColor={carPalette.hex}
                  shadowBlur={12}
                  shadowOpacity={0.6}
                  shadowOffsetY={0}
                />
                {/* Car Windows (simplified) */}
                <Rect x={-5} y={-8} width={15} height={16} fill="#083344" cornerRadius={2} />
                {/* Direction indicator (front of car is right) */}
                <Circle x={12} y={-6} radius={2} fill="#fef08a" shadowColor="#fef08a" shadowBlur={5} />
                <Circle x={12} y={6} radius={2} fill="#fef08a" shadowColor="#fef08a" shadowBlur={5} />
                {/* Trail effect */}
                <Rect
                  x={-35}
                  y={-6}
                  width={20}
                  height={12}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                  fillLinearGradientEndPoint={{ x: 20, y: 0 }}
                  fillLinearGradientColorStops={[0, `rgba(${carPalette.rgb}, 0)`, 1, `rgba(${carPalette.rgb}, 0.3)`]}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex flex-col space-y-2 rounded-xl bg-slate-900/80 p-2 shadow-lg border border-slate-700/50 backdrop-blur-md">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-lg transition-colors"
          onClick={() => onScaleChange(Math.min(scale * 1.2, 10))}
          title="Zoom In"
        >
          +
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-lg transition-colors"
          onClick={() => onScaleChange(Math.max(scale / 1.2, 0.3))}
          title="Zoom Out"
        >
          -
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-medium transition-colors"
          onClick={() => { onScaleChange(1); onPositionChange(50, 200); }}
          title="Reset View"
        >
          1:1
        </button>
      </div>
    </div>
  );
}
