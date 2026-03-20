export interface Car {
  id: string;
  x: number; // meters
  lane: number; // 1, 2, 3, 4
  speed: number; // km/h
  cameraId?: string;
}

export interface Camera {
  id: string;
  x: number; // meters
}
