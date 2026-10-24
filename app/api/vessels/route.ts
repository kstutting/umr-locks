import { NextResponse } from "next/server";
import {
  currentVessels,
  finishedPassages,
  queueUrl,
  type LockVessels,
  type VesselsResponse,
} from "@/lib/vessels";

const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_LOCKS = 3;

type CacheEntry = {
  expiresAt: number;
  payload: LockVessels;
};

const cache = new Map<string, CacheEntry>();

async function fetchLockVessels(displayNumber: string): Promise<LockVessels> {
  const now = Date.now();
  const cached = cache.get(displayNumber);
  if (cached && cached.expiresAt > now) return cached.payload;

  const url = queueUrl(displayNumber);
  if (!url) return { vessels: [], through: [], error: "Unknown lock" };

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/xml, text/xml",
      "User-Agent": "UMR-Locks/1.0 (lock traffic viewer)",
    },
  });

  if (!response.ok) {
    throw new Error(`USACE queue returned ${response.status}`);
  }

  const xml = await response.text();
  if (/rate limit exceeded/i.test(xml)) {
    throw new Error("Corps queue is busy. Try again in a minute.");
  }

  const payload: LockVessels = {
    vessels: currentVessels(xml),
    through: finishedPassages(xml),
  };
  cache.set(displayNumber, { expiresAt: now + CACHE_TTL_MS, payload });
  return payload;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get("locks") ?? "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_LOCKS);

  if (requested.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one lock" },
      { status: 400 },
    );
  }

  const locks: VesselsResponse["locks"] = {};
  await Promise.all(
    requested.map(async (displayNumber) => {
      const cached = cache.get(displayNumber);
      try {
        locks[displayNumber] = await fetchLockVessels(displayNumber);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Vessel list unavailable";
        if (cached) {
          locks[displayNumber] = cached.payload;
          return;
        }
        locks[displayNumber] = { vessels: [], through: [], error: message };
      }
    }),
  );

  return NextResponse.json(
    { locks },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
