export type MileMarker = {
  mile: number;
  latitude: number;
  longitude: number;
};

export type MileEstimate =
  | { mile: number }
  | { error: "Not near the Upper Mississippi." };

/** A point farther than this from the nearest marker is not on the channel. */
const MAX_OFF_RIVER_MILES = 1.2;
const MILES_PER_DEG_LAT = 69;

function toLocalMiles(
  latitude: number,
  longitude: number,
  originLatitude: number,
): { x: number; y: number } {
  const milesPerDegLon =
    MILES_PER_DEG_LAT * Math.cos((originLatitude * Math.PI) / 180);
  return {
    x: longitude * milesPerDegLon,
    y: latitude * MILES_PER_DEG_LAT,
  };
}

function milesBetween(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const origin = (aLat + bLat) / 2;
  const a = toLocalMiles(aLat, aLon, origin);
  const b = toLocalMiles(bLat, bLon, origin);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function projectOntoSegment(
  latitude: number,
  longitude: number,
  start: MileMarker,
  end: MileMarker,
): { mile: number; offRiverMiles: number } {
  const origin = latitude;
  const point = toLocalMiles(latitude, longitude, origin);
  const a = toLocalMiles(start.latitude, start.longitude, origin);
  const b = toLocalMiles(end.latitude, end.longitude, origin);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  let t = 0;
  if (ab2 > 0) {
    t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / ab2;
    t = Math.min(1, Math.max(0, t));
  }
  const mile = start.mile + t * (end.mile - start.mile);
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return {
    mile,
    offRiverMiles: Math.hypot(point.x - closestX, point.y - closestY),
  };
}

function roundTenth(mile: number): number {
  return Math.round(mile * 10) / 10;
}

/**
 * Interpolate a river mile from nearby whole-mile markers.
 * Uses the nearest marker and the adjacent marker that puts the point
 * closest to the channel.
 */
export function estimateRiverMile(
  latitude: number,
  longitude: number,
  markers: MileMarker[],
): MileEstimate {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: "Not near the Upper Mississippi." };
  }

  const ranked = markers
    .filter(
      (marker) =>
        Number.isFinite(marker.mile) &&
        Number.isFinite(marker.latitude) &&
        Number.isFinite(marker.longitude),
    )
    .map((marker) => ({
      marker,
      distance: milesBetween(
        latitude,
        longitude,
        marker.latitude,
        marker.longitude,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearest = ranked[0];
  if (!nearest || nearest.distance > MAX_OFF_RIVER_MILES) {
    return { error: "Not near the Upper Mississippi." };
  }

  const adjacent = ranked.filter(
    (entry) => Math.abs(entry.marker.mile - nearest.marker.mile) === 1,
  );

  let bestMile = nearest.marker.mile;
  if (adjacent.length > 0) {
    let bestOff = Number.POSITIVE_INFINITY;
    for (const entry of adjacent) {
      const projected = projectOntoSegment(
        latitude,
        longitude,
        nearest.marker,
        entry.marker,
      );
      if (projected.offRiverMiles < bestOff) {
        bestOff = projected.offRiverMiles;
        bestMile = projected.mile;
      }
    }
  }

  return { mile: roundTenth(bestMile) };
}
