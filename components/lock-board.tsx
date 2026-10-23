"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LockStatus, LocksResponse } from "@/lib/locks";

const REFRESH_MS = 3 * 60 * 1000;

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMile(mm: number | null): string {
  if (mm === null) return "—";
  return `MM ${mm}`;
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-base tabular-nums leading-tight",
          emphasize && value > 0
            ? "text-[var(--signal)] font-semibold"
            : "text-[var(--ink)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function LockRow({ lock }: { lock: LockStatus }) {
  const [open, setOpen] = useState(false);
  const hasNotes = Boolean(lock.notes);

  return (
    <article
      className={cn(
        "border-b border-[var(--line)] px-4 py-3.5 transition-colors sm:px-5",
        lock.busy && "bg-[var(--busy-wash)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="font-[family-name:var(--font-display)] text-xl leading-none tracking-tight text-[var(--ink)] sm:text-2xl">
              Lock {lock.displayNumber}
            </h2>
            <span className="font-mono text-sm tabular-nums text-[var(--accent)]">
              {formatMile(lock.mileMarker)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--ink-muted)]">
            {lock.lockName}
          </p>
        </div>
        {lock.busy && (
          <span className="shrink-0 rounded-sm border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-[var(--signal)]">
            Active
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Pending" value={lock.pendingArrivals} emphasize />
        <Stat label="Locking" value={lock.locking} emphasize />
        <Stat label="Up 24h" value={lock.lockedUp24Hours} />
        <Stat label="Down 24h" value={lock.lockedDown24Hours} />
        <Stat label="Avg delay" value={lock.average24HourDelay} />
      </dl>

      {hasNotes && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left text-xs font-medium uppercase tracking-[0.1em] text-[var(--accent)] underline-offset-2 hover:underline"
            aria-expanded={open}
          >
            {open ? "Hide notes" : "Lockmaster notes"}
          </button>
          {open && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              {lock.notes}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function SkeletonList() {
  return (
    <div className="animate-pulse divide-y divide-[var(--line)]" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3 px-4 py-4 sm:px-5">
          <div className="h-6 w-40 rounded bg-[var(--line)]" />
          <div className="h-3 w-24 rounded bg-[var(--line)]" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((__, j) => (
              <div key={j} className="h-8 rounded bg-[var(--line)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LockBoard() {
  const [data, setData] = useState<LocksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/locks", { cache: "no-store" });
      const body = (await res.json()) as LocksResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load locks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const busyCount = data?.locks.filter((l) => l.busy).length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <header className="relative overflow-hidden border-b border-[var(--line)] px-4 pb-6 pt-8 sm:px-5 sm:pt-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 80% at 10% -20%, color-mix(in oklab, var(--water) 55%, transparent), transparent 55%), linear-gradient(180deg, color-mix(in oklab, var(--water-deep) 35%, transparent), transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--accent)]">
            Upper Mississippi River
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight text-[var(--ink)] sm:text-5xl">
            UMR Locks
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            Live Corps of Engineers traffic for locks 1–26, with river mile
            markers.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--ink-muted)]">
            <span className="font-mono tabular-nums">
              Updated {formatUpdatedAt(data?.updatedAt ?? null)}
            </span>
            {data && (
              <span className="font-mono tabular-nums">
                {busyCount} active · {data.locks.length} locks
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="border-[var(--line-strong)] bg-[var(--panel)]/60 text-[var(--ink)] hover:bg-[var(--panel)]"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-[var(--panel)]/40">
        {loading && !data && <SkeletonList />}

        {!loading && error && !data && (
          <div className="px-4 py-10 text-center sm:px-5">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              Traffic unavailable
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-muted)]">
              {error}. The Corps LPMS feed may be briefly offline.
            </p>
            <Button
              type="button"
              className="mt-5"
              onClick={() => void load(false)}
            >
              Try again
            </Button>
          </div>
        )}

        {data && (
          <>
            {error && (
              <div className="border-b border-[var(--signal)]/30 bg-[var(--signal)]/10 px-4 py-2 text-sm text-[var(--signal)] sm:px-5">
                Refresh failed: {error}. Showing last successful data.
              </div>
            )}
            <div>
              {data.locks.map((lock) => (
                <LockRow key={lock.lockNumber} lock={lock} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--line)] px-4 py-4 text-xs text-[var(--ink-muted)] sm:px-5">
        Data from USACE Lock Performance Monitoring System. Auto-refreshes every
        3 minutes. Lock 5A included; there is no Lock 23.
      </footer>
    </div>
  );
}
