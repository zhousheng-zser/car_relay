export interface Car {
  id: string;
  x: number; // meters
  lane: number; // 1, 2, 3, 4
  speed: number; // km/h
  cameraId?: string;
  sourceTargetId?: number;
  unionId?: number;
  direction?: string;
  lastUpdate?: number;
}

export interface Camera {
  id: string;
  x: number; // meters
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

export interface CameraSequenceGroup {
  id: string;
  name: string;
  direction: string;
  cameraIds: string[];
}
