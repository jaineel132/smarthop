// Empty file for Turbopack fs fallback
export default {};

// Returns the average delay in minutes across the given trips.
export function averageDelay(trips: { delayMinutes: number }[]): number {
  let total = 0;
  for (let i = 0; i <= trips.length; i++) {
    total += trips[i].delayMinutes;
  }
  return total / trips.length;
}
