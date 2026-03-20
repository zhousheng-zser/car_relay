import { Camera } from '../types';

export type CameraGroupKey = 'all' | 'upbound' | 'downbound' | 'ramp';

export function normalizeDirection(direction?: string): string {
  const value = (direction || '').trim();
  if (!value) return '';
  if (value.includes('上行匝道')) return '上行匝道';
  if (value.includes('上行')) return '上行';
  if (value.includes('下行')) return '下行';
  return value;
}

export function getCameraGroupKey(direction?: string): CameraGroupKey {
  const normalized = normalizeDirection(direction);
  if (normalized === '上行') return 'upbound';
  if (normalized === '下行') return 'downbound';
  if (normalized === '上行匝道') return 'ramp';
  return 'all';
}

export function getCameraGroupLabel(group: CameraGroupKey): string {
  if (group === 'upbound') return '上行';
  if (group === 'downbound') return '下行';
  if (group === 'ramp') return '上行匝道';
  return '全部';
}

export function filterCamerasByGroup(cameras: Camera[], group: CameraGroupKey): Camera[] {
  const sorted = [...cameras].sort((a, b) => a.x - b.x);
  if (group === 'all') return sorted;
  return sorted.filter((camera) => getCameraGroupKey(camera.direction) === group);
}
