export type VesselMovement = {
  name: string;
  status: "locking" | "pending";
  statusLabel: "In lock" | "Pending";
  direction: string;
  barges: number;
  bargeLabel: string;
  whenLabel: string;
  next: boolean;
};

export type LockVessels = {
  vessels: VesselMovement[];
  error?: string;
};

export type VesselsResponse = {
  locks: Record<string, LockVessels>;
};

type QueueRow = {
  VESSEL_NAME?: string;
  DIRECTION?: string;
  NUM_BARGES?: string;
  SOL_DATE?: string;
  ARRIVAL_DATE?: string;
  END_OF_LOCKAGE?: string;
};

const UMR_DISPLAY = new Set([
  "1",
  "2",
  "3",
  "4",
  "5",
  "5A",
  "6",
  "7",
  "8",
  "9",
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

export function usaceLockQuery(displayNumber: string): string | null {
  const id = displayNumber.trim().toUpperCase();
  if (!UMR_DISPLAY.has(id)) return null;
  if (id === "5A") return "55";
  return String(Number(id));
}

export function queueUrl(displayNumber: string): string | null {
  const code = usaceLockQuery(displayNumber);
  if (!code) return null;
  return `https://ndc.ops.usace.army.mil/ords/lockqueue_xml?in_lock=${code}&in_river=MI`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRows(xml: string): QueueRow[] {
  const clean = [...xml].map((ch) => (ch.charCodeAt(0) < 32 ? " " : ch)).join("");
  const rows: QueueRow[] = [];
  for (const chunk of clean.split(/<ROW>/i).slice(1)) {
    const row: Record<string, string> = {};
    for (const match of chunk.matchAll(/<([A-Z0-9_]+)>([^<]*)<\/\1>/g)) {
      row[match[1]] = decodeXml(match[2]);
    }
    rows.push(row);
  }
  return rows;
}

function timeKey(value: string | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const year = 2000 + Number(match[3]);
  return Date.UTC(
    year,
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[4]),
    Number(match[5]),
  );
}

function formatClock(value: string | undefined): string | null {
  if (!value) return null;
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return value.trim();
  let hour = Number(match[4]);
  const minute = match[5];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function directionLabel(code: string | undefined): string {
  if (code === "U") return "Upbound";
  if (code === "D") return "Downbound";
  return "Direction unknown";
}

function bargeLabel(count: number): string {
  if (count === 0) return "no barges";
  if (count === 1) return "1 barge";
  return `${count} barges`;
}

export function currentVessels(xml: string): VesselMovement[] {
  const locking: Array<VesselMovement & { sort: number }> = [];
  const pending: Array<VesselMovement & { sort: number }> = [];

  for (const row of parseRows(xml)) {
    if (row.END_OF_LOCKAGE) continue;
    const name = row.VESSEL_NAME?.trim();
    if (!name) continue;
    const barges = Number(row.NUM_BARGES);
    const bargeCount = Number.isFinite(barges) ? barges : 0;
    const direction = directionLabel(row.DIRECTION);
    const base = {
      name,
      direction,
      barges: bargeCount,
      bargeLabel: bargeLabel(bargeCount),
      next: false,
    };

    if (row.SOL_DATE) {
      const clock = formatClock(row.SOL_DATE);
      locking.push({
        ...base,
        status: "locking",
        statusLabel: "In lock",
        whenLabel: clock ? `Started ${clock}` : "In the lock",
        sort: timeKey(row.SOL_DATE),
      });
      continue;
    }

    if (row.ARRIVAL_DATE) {
      const clock = formatClock(row.ARRIVAL_DATE);
      pending.push({
        ...base,
        status: "pending",
        statusLabel: "Pending",
        whenLabel: clock ? `Arrival ${clock}` : "Waiting",
        sort: timeKey(row.ARRIVAL_DATE),
      });
    }
  }

  locking.sort((a, b) => a.sort - b.sort);
  pending.sort((a, b) => a.sort - b.sort);
  if (pending[0]) pending[0].next = true;

  return [...locking, ...pending].map(({ sort: _sort, ...vessel }) => vessel);
}
