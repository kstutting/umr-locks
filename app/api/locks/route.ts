import { NextResponse } from "next/server";
import {
  parseUsaceLockStatus,
  USACE_LOCK_STATUS_URL,
  type LocksResponse,
} from "@/lib/locks";

const CACHE_TTL_MS = 3 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  payload: LocksResponse;
};

let cache: CacheEntry | null = null;

async function fetchLocks(): Promise<LocksResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.payload;
  }

  const response = await fetch(USACE_LOCK_STATUS_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "UMR-Locks/1.0 (lock traffic viewer)",
    },
  });

  if (!response.ok) {
    throw new Error(`USACE returned ${response.status}`);
  }

  const raw = await response.text();
  const payload = parseUsaceLockStatus(raw);
  cache = { expiresAt: now + CACHE_TTL_MS, payload };
  return payload;
}

export async function GET() {
  try {
    const payload = await fetchLocks();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lock status";
    return NextResponse.json(
      { error: message },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
