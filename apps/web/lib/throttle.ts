// Wraps a progress callback so it fires at most once per `intervalMs`. The
// first call always goes through. Callers report completion separately, so
// dropping intermediate values is fine.
export function throttleProgress(
  callback: (value: number) => void,
  intervalMs = 100,
  now: () => number = () => performance.now(),
): (value: number) => void {
  let last = -Infinity;
  return (value) => {
    const t = now();
    if (t - last < intervalMs) return;
    last = t;
    callback(value);
  };
}
