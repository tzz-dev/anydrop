export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// Average speed and remaining time for a transfer, or null while there is not
// enough data for a meaningful estimate.
export function estimateTransfer(
  bytesDone: number,
  size: number,
  startedAt: number | undefined,
  updatedAt: number | undefined,
): { bytesPerSecond: number; remainingSeconds: number } | null {
  if (startedAt === undefined || updatedAt === undefined) return null;
  const elapsedMs = updatedAt - startedAt;
  if (elapsedMs < 1000 || bytesDone <= 0) return null;
  const bytesPerSecond = bytesDone / (elapsedMs / 1000);
  return { bytesPerSecond, remainingSeconds: (size - bytesDone) / bytesPerSecond };
}
