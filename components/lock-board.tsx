"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LockStatus, LocksResponse } from "@/lib/locks";
import { lockContact } from "@/lib/lock-contacts";
import type { LockVessels, VesselMovement, VesselsResponse } from "@/lib/vessels";

const REFRESH_MS = 3 * 60 * 1000;
const DEFAULT_LOCK = "13";
const PAST_HOUR_OPTIONS = [4, 8, 12, 24, 48] as const;

function withoutRecreational(
  vessels: VesselMovement[],
  showRec: boolean,
): VesselMovement[] {
  if (showRec) return vessels;
  return vessels.filter((vessel) => !vessel.recreational);
}

function windowAround(locks: LockStatus[], selectedId: string): LockStatus[] {
  const index = locks.findIndex((lock) => lock.displayNumber === selectedId);
  if (index < 0) return [];
  return locks.slice(Math.max(0, index - 1), index + 2);
}

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

function VesselLine({ vessel }: { vessel: VesselMovement }) {
  const label =
    vessel.status === "locking"
      ? "In lock"
      : vessel.status === "passed"
        ? "Through"
        : vessel.next
          ? "Next"
          : "Pending";
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium tracking-tight text-[var(--ink)]">
          {vessel.name}
        </p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          {vessel.direction} · {vessel.bargeLabel} · {vessel.whenLabel}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider",
          vessel.status === "locking"
            ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-[var(--accent)]"
            : vessel.next
              ? "border-[var(--signal)]/60 bg-[var(--signal)]/15 text-[var(--signal)]"
              : "border-[var(--line-strong)] text-[var(--ink-muted)]",
        )}
      >
        {label}
      </span>
    </li>
  );
}

function VesselList({
  report,
  loading,
  pastHours,
  showRec,
}: {
  report: LockVessels | undefined;
  loading: boolean;
  pastHours: number;
  showRec: boolean;
}) {
  if (!report && loading) {
    return (
      <p className="mt-3 text-xs text-[var(--ink-muted)]">Loading vessels…</p>
    );
  }
  if (!report) return null;
  const throughAll = report.through ?? [];
  if (report.error && report.vessels.length === 0 && throughAll.length === 0) {
    return (
      <p className="mt-3 text-xs text-[var(--signal)]">{report.error}</p>
    );
  }

  const inLock = withoutRecreational(
    report.vessels.filter((vessel) => vessel.status === "locking"),
    showRec,
  );
  const pending = withoutRecreational(
    report.vessels.filter((vessel) => vessel.status === "pending"),
    showRec,
  ).map((vessel, index) => ({ ...vessel, next: index === 0 }));
  const cutoff = Date.now() - pastHours * 60 * 60 * 1000;
  const through = withoutRecreational(
    throughAll.filter((vessel) => (vessel.finishedAt ?? 0) >= cutoff),
    showRec,
  );

  return (
    <div className="mt-3 space-y-2">
      {inLock.length > 0 && (
        <section>
          <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent)]">
            In the lock
          </h3>
          <ul className="divide-y divide-[var(--line)]">
            {inLock.map((vessel, index) => (
              <VesselLine key={`lock-${vessel.name}-${index}`} vessel={vessel} />
            ))}
          </ul>
        </section>
      )}
      {pending.length > 0 && (
        <section>
          <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--signal)]">
            Pending
          </h3>
          <ul className="divide-y divide-[var(--line)]">
            {pending.map((vessel, index) => (
              <VesselLine
                key={`wait-${vessel.name}-${index}`}
                vessel={vessel}
              />
            ))}
          </ul>
        </section>
      )}
      {inLock.length === 0 && pending.length === 0 && (
        <p className="text-xs text-[var(--ink-muted)]">
          No vessels in the lock or waiting.
        </p>
      )}
      <section>
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Through · last {pastHours} hours
        </h3>
        {through.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            None finished in the last {pastHours} hours.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {through.map((vessel, index) => (
              <VesselLine
                key={`through-${vessel.name}-${index}`}
                vessel={vessel}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LockRow({
  lock,
  selected,
  vessels,
  vesselsLoading,
  pastHours,
  showRec,
}: {
  lock: LockStatus;
  selected: boolean;
  vessels: LockVessels | undefined;
  vesselsLoading: boolean;
  pastHours: number;
  showRec: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasNotes = Boolean(lock.notes);
  const contact = lockContact(lock.displayNumber);

  return (
    <article
      className={cn(
        "border-b border-[var(--line)] px-4 py-3.5 transition-colors sm:px-5",
        lock.busy && "bg-[var(--busy-wash)]",
        selected &&
          "border-l-2 border-l-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
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
            {contact && (
              <>
                <span className="font-mono text-sm tabular-nums text-[var(--ink-soft)]">
                  Ch {contact.channel}
                </span>
                <a
                  href={`tel:${contact.tel}`}
                  className="font-mono text-sm tabular-nums text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  {contact.phone}
                </a>
              </>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-[var(--ink-muted)]">
            {lock.lockName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {selected && (
            <span className="rounded-sm border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-[var(--accent)]">
              Selected
            </span>
          )}
          {lock.busy && (
            <span className="rounded-sm border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-[var(--signal)]">
              Active
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Pending" value={lock.pendingArrivals} emphasize />
        <Stat label="Locking" value={lock.locking} emphasize />
        <Stat label="Up 24h" value={lock.lockedUp24Hours} />
        <Stat label="Down 24h" value={lock.lockedDown24Hours} />
        <Stat label="Avg delay" value={lock.average24HourDelay} />
      </dl>

      <VesselList
        report={vessels}
        loading={vesselsLoading}
        pastHours={pastHours}
        showRec={showRec}
      />

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
      {Array.from({ length: 3 }).map((_, i) => (
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
  const [selectedId, setSelectedId] = useState(DEFAULT_LOCK);
  const [pastHours, setPastHours] = useState<number>(8);
  const [showRec, setShowRec] = useState(false);
  const [vesselsByLock, setVesselsByLock] = useState<
    VesselsResponse["locks"]
  >({});
  const [vesselsLoading, setVesselsLoading] = useState(false);
  const [vesselTick, setVesselTick] = useState(0);

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
      if (isRefresh) setVesselTick((tick) => tick + 1);
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
  const windowLocks = useMemo(
    () => (data ? windowAround(data.locks, selectedId) : []),
    [data, selectedId],
  );
  const windowKey = windowLocks.map((lock) => lock.displayNumber).join(",");

  useEffect(() => {
    if (!windowKey) return;
    let cancelled = false;
    setVesselsLoading(true);
    void fetch(`/api/vessels?locks=${encodeURIComponent(windowKey)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json()) as VesselsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error || "Vessel list unavailable");
        return body;
      })
      .then((body) => {
        if (!cancelled) setVesselsByLock(body.locks);
      })
      .catch(() => {
        if (!cancelled) {
          setVesselsByLock((current) => {
            const next = { ...current };
            for (const id of windowKey.split(",")) {
              if (!next[id]) {
                next[id] = {
                  vessels: [],
                  through: [],
                  error: "Vessel list unavailable",
                };
              }
            }
            return next;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setVesselsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [windowKey, vesselTick]);

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
            <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                Lock
              </span>
              <select
                aria-label="Lock"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                disabled={!data}
                className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] px-2 font-mono text-sm text-[var(--ink)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-3 focus-visible:ring-[var(--accent)]/40 disabled:opacity-50"
              >
                {data ? (
                  data.locks.map((lock) => (
                    <option key={lock.lockNumber} value={lock.displayNumber}>
                      Lock {lock.displayNumber}
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_LOCK}>Lock {DEFAULT_LOCK}</option>
                )}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                Past
              </span>
              <select
                aria-label="Hours of past lockages"
                value={pastHours}
                onChange={(event) => setPastHours(Number(event.target.value))}
                className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] px-2 font-mono text-sm text-[var(--ink)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-3 focus-visible:ring-[var(--accent)]/40"
              >
                {PAST_HOUR_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} hours
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={showRec}
                onChange={(event) => setShowRec(event.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                Rec locks
              </span>
            </label>
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
              {windowLocks.map((lock) => (
                <LockRow
                  key={lock.lockNumber}
                  lock={lock}
                  selected={lock.displayNumber === selectedId}
                  vessels={vesselsByLock[lock.displayNumber]}
                  vesselsLoading={vesselsLoading}
                  pastHours={pastHours}
                  showRec={showRec}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--line)] px-4 py-4 text-xs text-[var(--ink-muted)] sm:px-5">
        Data from USACE Lock Performance Monitoring System. VHF channel and
        phone from Corps locking-through and Rock Island District contact lists.
        Auto-refreshes every 3 minutes. Lock 5A included; there is no Lock 23.
      </footer>
    </div>
  );
}
