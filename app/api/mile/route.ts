import { NextResponse } from "next/server";
import { estimateRiverMile, type MileMarker } from "@/lib/river-mile";

const MARKER_URL =
  "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/arcgis/rest/services/usace_river_mile_markers/FeatureServer/0/query";

const SEARCH_MILES = 3;
const CACHE_TTL_MS = 2 * 60 * 1000;

type ArcFeature = {
  attributes?: {
    MILE?: number | null;
    LATITUDE1?: number | null;
    LONGITUDE1?: number | null;
    RIVER_NAME?: string | null;
  };
};

type ArcResponse = {
  features?: ArcFeature[];
  error?: { message?: string };
};

type CacheEntry = {
  expiresAt: number;
  body: { mile: number } | { error: string };
  status: number;
};

const cache = new Map<string, CacheEntry>();

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

async function fetchMarkers(latitude: number, longitude: number): Promise<MileMarker[]> {
  const url = new URL(MARKER_URL);
  url.searchParams.set("where", "RIVER_NAME='MISSISSIPPI-UP'");
  url.searchParams.set("geometry", `${longitude},${latitude}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("distance", String(SEARCH_MILES));
  url.searchParams.set("units", "esriSRUnit_StatuteMile");
  url.searchParams.set("outFields", "MILE,LATITUDE1,LONGITUDE1,RIVER_NAME");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "UMR-Locks/1.0 (lock traffic viewer)",
    },
  });

  if (!response.ok) {
    throw new Error(`USACE mile markers returned ${response.status}`);
  }

  const data = (await response.json()) as ArcResponse;
  if (data.error) {
    throw new Error(data.error.message || "USACE mile markers failed");
  }

  return (data.features ?? [])
    .map((feature) => {
      const mile = feature.attributes?.MILE;
      const lat = feature.attributes?.LATITUDE1;
      const lon = feature.attributes?.LONGITUDE1;
      const river = feature.attributes?.RIVER_NAME;
      if (
        river !== "MISSISSIPPI-UP" ||
        typeof mile !== "number" ||
        typeof lat !== "number" ||
        typeof lon !== "number"
      ) {
        return null;
      }
      return { mile, latitude: lat, longitude: lon };
    })
    .filter((marker): marker is MileMarker => marker !== null);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseCoordinate(searchParams.get("lat"), -90, 90);
  const longitude = parseCoordinate(searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "Latitude and longitude are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, {
      status: cached.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const markers = await fetchMarkers(latitude, longitude);
    const estimate = estimateRiverMile(latitude, longitude, markers);
    const body =
      "mile" in estimate
        ? { mile: estimate.mile, estimated: true }
        : { error: estimate.error };
    const status = 200;
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, body, status });
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not estimate a river mile.";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
