export type LockStatus = {
  lockNumber: string;
  displayNumber: string;
  lockName: string;
  mileMarker: number | null;
  pendingArrivals: number;
  locking: number;
  lockedUp24Hours: number;
  lockedDown24Hours: number;
  average24HourDelay: number;
  notes: string | null;
  busy: boolean;
};

export type LocksResponse = {
  riverName: string;
  updatedAt: string;
  locks: LockStatus[];
};

type UsaceLock = {
  lockNumber?: string | number;
  lockName?: string | null;
  lockMile?: number | string | null;
  totalPendingArrivals?: number | null;
  totalLocking?: number | null;
  totalLockedUp24Hours?: number | null;
  totalLockedDown24Hours?: number | null;
  average24HourDelay?: number | null;
  notes?: string | null;
};

type UsaceRiver = {
  riverName?: string;
  locks?: UsaceLock[];
};

/** USACE lock codes for UMR 1–26. 55 = Lock 5A. No Lock 23. */
const UMR_LOCK_CODES = new Set([
  "01",
  "02",
  "03",
  "04",
  "05",
  "55",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "24",
  "25",
  "26",
]);

const SORT_ORDER: Record<string, number> = {
  "01": 1,
  "02": 2,
  "03": 3,
  "04": 4,
  "05": 5,
  "55": 5.5,
  "06": 6,
  "07": 7,
  "08": 8,
  "09": 9,
  "10": 10,
  "11": 11,
  "12": 12,
  "13": 13,
  "14": 14,
  "15": 15,
  "16": 16,
  "17": 17,
  "18": 18,
  "19": 19,
  "20": 20,
  "21": 21,
  "22": 22,
  "24": 24,
  "25": 25,
  "26": 26,
};

export const USACE_LOCK_STATUS_URL =
  "https://ndc.ops.usace.army.mil/ords/lpms/lock_status_report_json?in_river_code=MI";

/** LPMS notes sometimes embed raw control characters that break JSON.parse. */
export function sanitizeUsaceJson(raw: string): string {
  return [...raw].map((ch) => (ch.charCodeAt(0) < 32 ? " " : ch)).join("");
}

function padLockNumber(value: string | number | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0");
  return raw;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function toMile(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function displayNumber(code: string): string {
  if (code === "55") return "5A";
  return String(Number(code));
}

function cleanNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const trimmed = notes.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLock(lock: UsaceLock): LockStatus | null {
  const lockNumber = padLockNumber(lock.lockNumber);
  if (!UMR_LOCK_CODES.has(lockNumber)) return null;

  const pendingArrivals = toNumber(lock.totalPendingArrivals);
  const locking = toNumber(lock.totalLocking);

  return {
    lockNumber,
    displayNumber: displayNumber(lockNumber),
    lockName: (lock.lockName || `L/D ${displayNumber(lockNumber)}`).trim(),
    mileMarker: toMile(lock.lockMile),
    pendingArrivals,
    locking,
    lockedUp24Hours: toNumber(lock.totalLockedUp24Hours),
    lockedDown24Hours: toNumber(lock.totalLockedDown24Hours),
    average24HourDelay: toNumber(lock.average24HourDelay),
    notes: cleanNotes(lock.notes),
    busy: pendingArrivals > 0 || locking > 0,
  };
}

export type MileSide = "upstream" | "downstream" | "at";

/**
 * River miles from the boat to a lock, and which way the lock lies.
 * Miles decrease downstream, toward Lock 26 and the Ohio at Cairo.
 */
export function distanceFromMile(
  yourMile: number,
  lockMile: number | null,
): { miles: number; side: MileSide } | null {
  if (
    lockMile === null ||
    !Number.isFinite(yourMile) ||
    !Number.isFinite(lockMile)
  ) {
    return null;
  }
  const miles = Math.abs(yourMile - lockMile);
  if (miles < 0.1) return { miles: 0, side: "at" };
  return {
    miles,
    side: yourMile > lockMile ? "downstream" : "upstream",
  };
}

export function parseUsaceLockStatus(raw: string): LocksResponse {
  const data = JSON.parse(sanitizeUsaceJson(raw)) as UsaceRiver[];
  const river = Array.isArray(data) ? data[0] : null;
  if (!river?.locks) {
    throw new Error("Unexpected USACE response shape");
  }

  const locks = river.locks
    .map(normalizeLock)
    .filter((lock): lock is LockStatus => lock !== null)
    .sort(
      (a, b) => (SORT_ORDER[a.lockNumber] ?? 99) - (SORT_ORDER[b.lockNumber] ?? 99),
    );

  return {
    riverName: river.riverName || "MISSISSIPPI RIVER",
    updatedAt: new Date().toISOString(),
    locks,
  };
}
