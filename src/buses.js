export const staleAfterSeconds = 120;

// shortcut: demo readings live in memory and reset on restart, add persistence in the next step.
const startedAt = Date.now();
export const buses = [
  {
    id: 'demo-bus-01',
    routeId: 'demo-mirpur-farmgate',
    latitude: 23.8021,
    longitude: 90.3705,
    lastUpdated: new Date(startedAt - 30_000).toISOString(),
  },
  {
    id: 'demo-bus-02',
    routeId: 'demo-mirpur-farmgate',
    latitude: 23.7801,
    longitude: 90.3791,
    lastUpdated: new Date(startedAt - 300_000).toISOString(),
  },
];

export function getBusLocations(routeId, now = Date.now()) {
  return buses.filter((bus) => bus.routeId === routeId).map((bus) => ({
    ...bus,
    isStale: now - Date.parse(bus.lastUpdated) >= staleAfterSeconds * 1000,
  }));
}
