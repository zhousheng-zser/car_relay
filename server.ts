import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';

const PORT = 3000;

interface Camera {
  id: string;
  x: number;
}

interface Car {
  id: string;
  cameraId: string;
  x: number;
  lane: number;
  speed: number;
  endX: number;
  targetLane?: number;
  laneChangeX?: number;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  let cameras: Camera[] = Array.from({ length: 100 }, (_, i) => ({
    id: `cam-${i + 1}`,
    x: i * 500
  }));
  let cars: Car[] = [];
  let carIdCounter = 0;
  
  const clientViewports = new Map<WebSocket, { startX: number, endX: number }>();

  // Mock Camera TCP Connection Logic (Simulated)
  // In the future, this is where you'd connect to actual cameras via TCP
  setInterval(() => {
    const dt = 0.1; // 100ms = 0.1s

    // 1. Update existing cars
    cars.forEach(car => {
      // speed is km/h. Convert to m/s: speed / 3.6
      const speedMs = car.speed / 3.6;
      car.x += speedMs * dt;

      // Execute lane change if the car has reached its designated lane change position
      if (car.targetLane && car.lane !== car.targetLane && car.laneChangeX && car.x >= car.laneChangeX) {
        car.lane = car.targetLane;
      }
    });

    // 2. Remove cars that passed their endX
    cars = cars.filter(car => car.x < car.endX);

    // 3. Spawn new cars for each camera
    cameras.forEach(cam => {
      // Significantly reduce density (from 2.5% to 0.5% per tick)
      if (Math.random() < 0.005) {
        const speed = 30 + Math.random() * 50; // 30 to 80 km/h
        const lane = Math.floor(Math.random() * 4) + 1;
        // Spawn car at camera.x + (0 to 10) meters
        const startX = cam.x + Math.random() * 10;
        // Car disappears at camera.x + (500 to 600) meters
        const endX = cam.x + 500 + Math.random() * 100;

        // 5% chance to change lane during its journey
        const willChangeLane = Math.random() < 0.05;
        let targetLane = lane;
        let laneChangeX = 0;
        
        if (willChangeLane) {
          targetLane = lane === 1 ? 2 : lane === 4 ? 3 : (Math.random() > 0.5 ? lane + 1 : lane - 1);
          // Change lane somewhere in the middle of the journey
          laneChangeX = startX + 50 + Math.random() * (endX - startX - 100);
        }

        cars.push({
          id: `car-${carIdCounter++}`,
          cameraId: cam.id,
          x: startX,
          lane,
          speed,
          endX,
          targetLane: willChangeLane ? targetLane : undefined,
          laneChangeX: willChangeLane ? laneChangeX : undefined
        });
      }
    });

    // 4. Broadcast to all connected clients based on their viewport
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const vp = clientViewports.get(client) || { startX: -5000, endX: 15000 };
        // Add a 2000m buffer so cars don't pop in/out abruptly
        const visibleCars = cars.filter(c => c.x >= vp.startX - 2000 && c.x <= vp.endX + 2000);
        
        client.send(JSON.stringify({ type: 'CARS_UPDATE', cars: visibleCars }));
      }
    });
  }, 100);

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Set default viewport and send initial state
    clientViewports.set(ws, { startX: -5000, endX: 15000 });
    ws.send(JSON.stringify({ type: 'INIT', cameras }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'SET_VIEWPORT') {
          clientViewports.set(ws, { startX: data.startX, endX: data.endX });
        } else if (data.type === 'SYNC_CAMERAS') {
          cameras = data.cameras;
          console.log('Synced cameras:', cameras.length);
        }
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clientViewports.delete(ws);
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
