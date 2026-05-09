import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Unknown';
}

export function getSignalingUrl(): string {
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) return process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3001`;
}

export function getSignalingHttpBase(): string {
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
    return process.env.NEXT_PUBLIC_SIGNALING_URL
      .replace(/^ws(s?):\/\//, (_, s: string) => `http${s}://`)
      .split('/')
      .slice(0, 3)
      .join('/');
  }
  if (typeof window === 'undefined') return '';
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

/**
 * Hash a password salted with the room code so that the same password in
 * different rooms produces different hashes, thwarting cross-room rainbow tables.
 */
export async function hashPassword(password: string, roomCode: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${roomCode}:${password}`);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
