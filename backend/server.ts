import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';

const PORT = Number(process.env.PORT || 3100);
const API_PREFIX = process.env.API_PREFIX || '/relay-api';
const REMOTE_COLLECTOR_URL = process.env.REMOTE_COLLECTOR_URL || 'http://127.0.0.1:5001';
const CAMERA_CONFIG_PATH =
  process.env.CAMERA_CONFIG_PATH || path.resolve(process.cwd(), 'backend', 'config', 'cameras_config.json');
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 200);
const STALE_TARGET_MS = Number(process.env.STALE_TARGET_MS || 1500);

interface Camera {
  id: string;
  x: number;
  ip?: string;
  heading?: number;
  latitude?: number;
  longitude?: number;
  direction?: string;
  connected?: boolean;
  enabled?: boolean;
  targetCount?: number;
  lastUpdate?: string;
}

interface Car {
  id: string;
  cameraId: string;
  x: number;
  lane: number;
  speed: number;
  sourceTargetId?: number;
  unionId?: number;
  direction?: string;
  lastUpdate?: number;
}

interface RemoteTarget {
  id?: number;
  union_id?: number;
  channel?: number;
  vrel_long?: number;
  dist_long?: number;
  dist_lat?: number;
  lon?: number;
  lat?: number;
  calculated_lon?: number;
  calculated_lat?: number;
}

interface RemoteCameraState {
  connected?: boolean;
  last_update?: string;
  targets?: RemoteTarget[];
}

interface RemoteRadarResponse {
  code?: number;
  data?: Record<string, RemoteCameraState>;
  timestamp?: string;
}

interface CameraConfig {
  ip: string;
  latitude: number;
  longitude: number;
  heading: number;
  enabled?: boolean;
  tags?: Record<string, string>;
}

interface CamerasConfigFile {
  cameras?: Record<string, Partial<CameraConfig>>;
}

interface ProjectedCamera extends CameraConfig {
  roadX: number;
  roadY: number;
  axisDistance: number;
}

interface TrackedCar extends Car {
  updatedAt: number;
}

const clientViewports = new Map<WebSocket, { startX: number; endX: number }>();
const trackedCars = new Map<string, TrackedCar>();
let projectedCameras = new Map<string, ProjectedCamera>();
let cameras: Camera[] = [];
let roadBounds = { minX: 0, maxX: 10000 };
let latestRemoteSnapshot: {
  fetchedAt: string;
  remoteTimestamp?: string;
  cameraCount: number;
  connectedCameraCount: number;
  payload: Record<string, RemoteCameraState>;
} = {
  fetchedAt: '',
  remoteTimestamp: '',
  cameraCount: 0,
  connectedCameraCount: 0,
  payload: {},
};
let projectionReference: {
  latitude: number;
  longitude: number;
  axisX: number;
  axisY: number;
  axisOffset: number;
} | null = null;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6378137;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function latLonToLocalMeters(lat: number, lon: number, refLat: number, refLon: number) {
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(degreesToRadians(refLat));
  return {
    x: (lon - refLon) * metersPerDegLon,
    y: (lat - refLat) * metersPerDegLat,
  };
}

function calculateDestination(lat: number, lon: number, bearingDegrees: number, distanceMeters: number) {
  const earthRadius = 6378137;
  const bearing = degreesToRadians(bearingDegrees);
  const lat1 = degreesToRadians(lat);
  const lon1 = degreesToRadians(lon);
  const angularDistance = distanceMeters / earthRadius;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lon2 * 180) / Math.PI,
  };
}

function calculateTargetPosition(camera: CameraConfig, target: RemoteTarget) {
  const posX = Number(target.dist_lat || 0);
  const posY = Number(target.dist_long || 0);
  const straightDistance = Math.sqrt(posX * posX + posY * posY);

  if (straightDistance < 0.001) {
    return { latitude: camera.latitude, longitude: camera.longitude };
  }

  const relativeAngle = (Math.atan2(posX, posY) * 180) / Math.PI;
  const targetBearing = (camera.heading + relativeAngle + 360) % 360;
  return calculateDestination(camera.latitude, camera.longitude, targetBearing, straightDistance);
}

function loadProjectedCameras() {
  const raw = fs.readFileSync(CAMERA_CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as CamerasConfigFile;
  const configs = Object.entries(parsed.cameras || {})
    .map(([ip, value]) => ({
      ip,
      latitude: Number(value.latitude || 0),
      longitude: Number(value.longitude || 0),
      heading: Number(value.heading || 0),
      enabled: value.enabled !== false,
      tags: value.tags || {},
    }))
    .filter((camera) => camera.enabled && camera.latitude && camera.longitude);

  if (configs.length === 0) {
    throw new Error(`No enabled cameras with coordinates found in ${CAMERA_CONFIG_PATH}`);
  }

  const refLat = configs.reduce((sum, item) => sum + item.latitude, 0) / configs.length;
  const refLon = configs.reduce((sum, item) => sum + item.longitude, 0) / configs.length;
  const localPoints = configs.map((camera) => ({
    ...camera,
    ...latLonToLocalMeters(camera.latitude, camera.longitude, refLat, refLon),
  }));

  const first = localPoints[0];
  const last = localPoints.reduce((best, current) => {
    const currentDistance = haversineMeters(first.latitude, first.longitude, current.latitude, current.longitude);
    const bestDistance = haversineMeters(first.latitude, first.longitude, best.latitude, best.longitude);
    return currentDistance > bestDistance ? current : best;
  }, first);

  let axisX = last.x - first.x;
  let axisY = last.y - first.y;
  const axisLength = Math.sqrt(axisX * axisX + axisY * axisY) || 1;
  axisX /= axisLength;
  axisY /= axisLength;

  const withAxis = localPoints.map((camera) => ({
    ...camera,
    axisDistance: camera.x * axisX + camera.y * axisY,
  }));
  const minAxis = Math.min(...withAxis.map((item) => item.axisDistance));
  const sorted = withAxis
    .map((camera) => ({
      ...camera,
      roadX: camera.axisDistance - minAxis,
      roadY: camera.y,
    }))
    .sort((a, b) => a.roadX - b.roadX);

  projectionReference = {
    latitude: refLat,
    longitude: refLon,
    axisX,
    axisY,
    axisOffset: minAxis,
  };

  projectedCameras = new Map(sorted.map((camera) => [camera.ip, camera]));
  cameras = sorted.map((camera) => ({
    id: camera.ip,
    ip: camera.ip,
    x: Number(camera.roadX.toFixed(2)),
    heading: Number(camera.heading.toFixed(2)),
    latitude: camera.latitude,
    longitude: camera.longitude,
    direction: camera.tags?.direction || '',
    connected: false,
    enabled: camera.enabled !== false,
    targetCount: 0,
    lastUpdate: '',
  }));

  const maxCameraX = Math.max(...cameras.map((camera) => camera.x));
  roadBounds = { minX: 0, maxX: maxCameraX + 1000 };

  console.log(`Loaded ${cameras.length} cameras from ${CAMERA_CONFIG_PATH}`);
}

function projectLatLonToRoadX(latitude: number, longitude: number): number | null {
  if (!projectionReference) {
    return null;
  }

  const local = latLonToLocalMeters(
    latitude,
    longitude,
    projectionReference.latitude,
    projectionReference.longitude
  );
  return local.x * projectionReference.axisX + local.y * projectionReference.axisY - projectionReference.axisOffset;
}

function projectTargetToRoad(camera: ProjectedCamera, target: RemoteTarget): number {
  const lon = Number(target.calculated_lon || target.lon || 0);
  const lat = Number(target.calculated_lat || target.lat || 0);

  if (lon && lat) {
    const projectedX = projectLatLonToRoadX(lat, lon);
    if (projectedX !== null) {
      return projectedX;
    }
  }

  const calculated = calculateTargetPosition(camera, target);
  const projectedX = projectLatLonToRoadX(calculated.latitude, calculated.longitude);
  if (projectedX !== null) {
    return projectedX;
  }

  return camera.roadX + Number(target.dist_long || 0);
}

function targetToCar(camera: ProjectedCamera, target: RemoteTarget, now: number): TrackedCar | null {
  const rawId = target.union_id ?? target.id;
  if (rawId === undefined || rawId === null) {
    return null;
  }

  const laneValue = Number(target.channel || 1);
  const lane = Number.isFinite(laneValue) ? Math.min(4, Math.max(1, Math.round(laneValue || 1))) : 1;
  const speed = Math.max(0, Number(target.vrel_long || 0) * 3.6);
  const x = projectTargetToRoad(camera, target);

  return {
    id: `${camera.ip}-${rawId}`,
    cameraId: camera.ip,
    x: Number.isFinite(x) ? Number(x.toFixed(2)) : camera.roadX,
    lane,
    speed: Number(speed.toFixed(1)),
    sourceTargetId: target.id,
    unionId: target.union_id,
    direction: camera.tags?.direction || '',
    lastUpdate: now,
    updatedAt: now,
  };
}

async function pollRemoteRadar() {
  const response = await fetch(`${REMOTE_COLLECTOR_URL}/api/radar`);
  if (!response.ok) {
    throw new Error(`Remote collector returned ${response.status}`);
  }

  const payload = (await response.json()) as RemoteRadarResponse;
  const nextCars = new Map<string, TrackedCar>();
  const now = Date.now();
  const cameraStatusByIp = new Map<string, Partial<Camera>>();
  let connectedCameraCount = 0;

  for (const [ip, cameraState] of Object.entries(payload.data || {})) {
    const camera = projectedCameras.get(ip);
    if (!camera) {
      continue;
    }

    cameraStatusByIp.set(ip, {
      connected: !!cameraState.connected,
      lastUpdate: cameraState.last_update || '',
      targetCount: (cameraState.targets || []).length,
    });

    if (!cameraState.connected) {
      continue;
    }
    connectedCameraCount += 1;

    for (const target of cameraState.targets || []) {
      const car = targetToCar(camera, target, now);
      if (car) {
        nextCars.set(car.id, car);
      }
    }
  }

  for (const [id, existing] of trackedCars) {
    if (now - existing.updatedAt < STALE_TARGET_MS && !nextCars.has(id)) {
      nextCars.set(id, existing);
    }
  }

  trackedCars.clear();
  for (const [id, car] of nextCars) {
    trackedCars.set(id, car);
  }

  cameras = cameras.map((camera) => ({
    ...camera,
    ...cameraStatusByIp.get(camera.id),
  }));

  latestRemoteSnapshot = {
    fetchedAt: new Date(now).toISOString(),
    remoteTimestamp: payload.timestamp || '',
    cameraCount: Object.keys(payload.data || {}).length,
    connectedCameraCount,
    payload: payload.data || {},
  };
}

async function postRemote(pathname: string, body: unknown) {
  const response = await fetch(`${REMOTE_COLLECTOR_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Remote collector returned ${response.status}`);
  }

  return data;
}

async function deleteRemote(pathname: string) {
  const response = await fetch(`${REMOTE_COLLECTOR_URL}${pathname}`, {
    method: 'DELETE',
  });
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Remote collector returned ${response.status}`);
  }

  return data;
}

function broadcastCars(wss: WebSocketServer) {
  const allCars = [...trackedCars.values()]
    .filter((car) => car.x >= roadBounds.minX - 1000 && car.x <= roadBounds.maxX + 3000)
    .sort((a, b) => a.x - b.x);

  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }

    const viewport = clientViewports.get(client) || { startX: -5000, endX: 15000 };
    const visibleCars = allCars.filter(
      (car) => car.x >= viewport.startX - 2000 && car.x <= viewport.endX + 2000
    );

    client.send(JSON.stringify({ type: 'CARS_UPDATE', cars: visibleCars }));
    client.send(
      JSON.stringify({
        type: 'DEBUG_UPDATE',
        debug: latestRemoteSnapshot,
      })
    );
  });
}

async function startPollingLoop(wss: WebSocketServer) {
  while (true) {
    try {
      await pollRemoteRadar();
      broadcastCars(wss);
    } catch (error) {
      console.error('Failed to poll remote radar:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function startServer() {
  loadProjectedCameras();

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({
      ok: true,
      remoteCollectorUrl: REMOTE_COLLECTOR_URL,
      cameraConfigPath: CAMERA_CONFIG_PATH,
      cameraCount: cameras.length,
      trackedCars: trackedCars.size,
    });
  });

  app.get(`${API_PREFIX}/cameras`, (_req, res) => {
    res.json({ code: 200, data: cameras });
  });

  app.get(`${API_PREFIX}/cameras/full`, (_req, res) => {
    res.json({
      code: 200,
      data: cameras,
      remoteCollectorUrl: REMOTE_COLLECTOR_URL,
      cameraConfigPath: CAMERA_CONFIG_PATH,
    });
  });

  app.get(`${API_PREFIX}/debug/raw`, (_req, res) => {
    res.json({
      code: 200,
      data: latestRemoteSnapshot,
    });
  });

  app.post(`${API_PREFIX}/cameras/reload-config`, (_req, res) => {
    try {
      loadProjectedCameras();
      res.json({ code: 200, message: 'Camera config reloaded', data: cameras });
    } catch (error) {
      res.status(500).json({ code: 500, message: error instanceof Error ? error.message : 'Reload failed' });
    }
  });

  app.post(`${API_PREFIX}/cameras/sync-remote`, async (_req, res) => {
    try {
      const ips = cameras.map((camera) => camera.ip).filter((ip): ip is string => !!ip);
      const result = await postRemote('/api/cameras/batch', { ips });
      res.json({ code: 200, message: 'Remote collector sync completed', data: result });
    } catch (error) {
      res.status(502).json({ code: 502, message: error instanceof Error ? error.message : 'Remote sync failed' });
    }
  });

  app.post(`${API_PREFIX}/cameras`, express.json(), async (req, res) => {
    const ip = String(req.body?.ip || '').trim();
    if (!ip) {
      res.status(400).json({ code: 400, message: 'Missing ip' });
      return;
    }

    try {
      const result = await postRemote('/api/cameras/add', { ip });
      res.json({ code: 200, message: 'Camera added to remote collector', data: result });
    } catch (error) {
      res.status(502).json({ code: 502, message: error instanceof Error ? error.message : 'Add camera failed' });
    }
  });

  app.delete(`${API_PREFIX}/cameras/:ip`, async (req, res) => {
    const ip = req.params.ip;
    try {
      const result = await deleteRemote(`/api/cameras/${encodeURIComponent(ip)}/remove`);
      res.json({ code: 200, message: 'Camera removed from remote collector', data: result });
    } catch (error) {
      res.status(502).json({ code: 502, message: error instanceof Error ? error.message : 'Remove camera failed' });
    }
  });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    clientViewports.set(ws, { startX: -5000, endX: 15000 });
    ws.send(JSON.stringify({ type: 'INIT', cameras }));
    ws.send(JSON.stringify({ type: 'CARS_UPDATE', cars: [...trackedCars.values()] }));
    ws.send(JSON.stringify({ type: 'DEBUG_UPDATE', debug: latestRemoteSnapshot }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'SET_VIEWPORT') {
          clientViewports.set(ws, { startX: Number(data.startX || 0), endX: Number(data.endX || 0) });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    });

    ws.on('close', () => {
      clientViewports.delete(ws);
      console.log('Client disconnected');
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API prefix: ${API_PREFIX}`);
    console.log(`Remote collector: ${REMOTE_COLLECTOR_URL}`);
    console.log(`Camera config: ${CAMERA_CONFIG_PATH}`);
  });

  void startPollingLoop(wss);
}

startServer().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
