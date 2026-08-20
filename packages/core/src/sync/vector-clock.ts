import type { VectorClock } from '@tessera/schemas';

export type ClockOrdering = 'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT';

/**
 * Creates a fresh empty vector clock.
 */
export const createVectorClock = (): VectorClock => ({});

/**
 * Increments the lamport counter for a specific device.
 */
export const incrementVectorClock = (
  clock: VectorClock,
  deviceId: string,
): VectorClock => {
  const current = clock[deviceId] ?? 0;
  return {
    ...clock,
    [deviceId]: current + 1,
  };
};

/**
 * Merges two vector clocks by taking the pointwise maximum for every known device.
 */
export const mergeVectorClocks = (
  a: VectorClock,
  b: VectorClock,
): VectorClock => {
  const merged: VectorClock = { ...a };
  for (const [deviceId, counter] of Object.entries(b)) {
    const existing = merged[deviceId] ?? 0;
    merged[deviceId] = Math.max(existing, counter);
  }
  return merged;
};

/**
 * Compares two vector clocks to determine causality.
 */
export const compareVectorClocks = (
  a: VectorClock,
  b: VectorClock,
): ClockOrdering => {
  let aHasGreater = false;
  let bHasGreater = false;

  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const device of allDevices) {
    const counterA = a[device] ?? 0;
    const counterB = b[device] ?? 0;

    if (counterA > counterB) {
      aHasGreater = true;
    } else if (counterB > counterA) {
      bHasGreater = true;
    }
  }

  if (aHasGreater && bHasGreater) {
    return 'CONCURRENT';
  }
  if (aHasGreater) {
    return 'AFTER';
  }
  if (bHasGreater) {
    return 'BEFORE';
  }
  return 'EQUAL';
};
