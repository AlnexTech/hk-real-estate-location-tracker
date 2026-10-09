import type { FieldDef, FocusKey, Location, Priority } from "./types";

export const STAGES = [
  "2 - Site Search",
  "3 - LOI",
  "4 - Lease",
  "5 - Under Construction",
  "6 - Open",
  "1 - Market (No Site)",
  "On Hold",
  "Dead",
] as const;

export const SHORT: Record<string, string> = {
  "1 - Market (No Site)": "Market",
  "2 - Site Search": "Site Search",
  "3 - LOI": "LOI",
  "4 - Lease": "Lease Negotiation",
  "5 - Under Construction": "Under Construction",
  "6 - Open": "Open",
  "On Hold": "On Hold",
  Dead: "Dead",
};

export const LOIS = [
  "",
  "Not Started",
  "Drafting",
  "Sent to Landlord",
  "Counter Received",
  "Negotiating",
  "Signed",
  "Dead",
];

export const HEALTH = ["", "Green", "Yellow", "Red"];

/** Lease-health labels. Stored values stay Green / Yellow / Red. */
export const HEALTH_LABEL: Record<string, string> = {
  Green: "On track",
  Yellow: "Watch",
  Red: "At risk",
};

export function healthLabel(value?: string | null): string {
  if (!value) return "";
  return HEALTH_LABEL[value] ?? value;
}
export const PRIOS: Priority[] = ["Low", "Medium", "High", "Back burner"];
export const OWN = ["", "Corporate", "Franchise", "Corporate + Partner"];
export const FORMAT = ["", "With Food Court", "Without Food Court"];
export const COUNTRIES = ["USA", "Canada", "Australia"];
export const TSTATUS = ["Not Started", "In Progress", "Done", "N/A"] as const;
export const STATUS_FIELDS = ["stage", "health", "priority"];

export const FIELDS: FieldDef[] = [
  ["sec", "Location"],
  ["city", "City / Market", "text"],
  ["state", "State / Province", "text"],
  ["country", "Country", "select", COUNTRIES],
  ["ownership", "Ownership", "select", OWN],
  ["format", "Format", "select", FORMAT],
  ["sqft", "Sq Ft", "number"],
  ["address", "Address", "text", "full"],
  ["landlord", "Landlord / Landlord Rep", "text", "full"],
  ["sec", "Status"],
  ["stage", "Stage", "select", [...STAGES]],
  ["health", "Lease health", "select", HEALTH],
  ["priority", "Priority", "select", PRIOS],
  ["sec", "LOI"],
  ["loiStatus", "LOI Status", "select", LOIS],
  ["loiSent", "LOI Sent", "date"],
  ["loiSigned", "LOI Signed", "date"],
  ["sec", "Lease"],
  ["leaseDraft", "Draft Received", "date"],
  ["leaseAttorney", "Sent to Attorney", "date"],
  ["leaseSigned", "Lease Signed", "date"],
  ["rentStart", "Rent Commencement", "date"],
  ["freeRent", "Free Rent (months)", "number"],
  ["ti", "TI Allowance ($)", "number"],
  ["baseRent", "Base Rent ($/mo)", "number"],
  ["nnn", "NNN", "number"],
  ["sec", "Franchise & Opening"],
  ["searchSince", "Search started", "date"],
  ["fddSigned", "FDD Signed", "date"],
  ["targetOpen", "Target Open", "date"],
  ["actualOpen", "Actual Open", "date"],
  ["sec", "Notes"],
  ["notesMfi", "Notes to MFI", "textarea", "full"],
  ["notes", "Internal Notes", "textarea", "full"],
  ["drive", "Drive Folder Link", "text", "full"],
];

export const FOCUS: Record<
  Exclude<FocusKey, "">,
  { label: string; fn: (l: Location) => boolean }
> = {
  open: { label: "Open locations", fn: (l) => l.stage === "6 - Open" },
  sitesearch: {
    label: "Site search",
    fn: (l) => l.stage === "2 - Site Search",
  },
  high: {
    label: "High priority",
    fn: (l) => prio(l) === "High" && l.stage !== "6 - Open",
  },
  loilease: {
    label: "LOI and lease",
    fn: (l) => l.stage === "3 - LOI" || l.stage === "4 - Lease",
  },
  build: {
    label: "Under construction",
    fn: (l) => l.stage === "5 - Under Construction",
  },
  flag: {
    label: "Lease at risk",
    fn: (l) => l.health === "Red" || l.health === "Yellow",
  },
  late: {
    label: "Target date passed",
    fn: (l) =>
      !!l.targetOpen &&
      !l.actualOpen &&
      l.stage !== "6 - Open" &&
      days(l.targetOpen)! < 0,
  },
  searching: {
    label: "Longest searches",
    fn: (l) => searching(l) !== null,
  },
};

/** Form and report fields, with Open date added to Status for open locations. */
export function fieldsForLocation(loc: Location): FieldDef[] {
  const fields: FieldDef[] = [];
  for (const field of FIELDS) {
    fields.push(field);
    if (field[0] === "priority" && loc.stage === "6 - Open") {
      fields.push(["actualOpen", "Open date", "date"]);
    }
  }
  return fields;
}

export function prio(l: Location): Priority {
  if (l.priority === "Normal") return "Medium";
  return PRIOS.includes(l.priority as Priority)
    ? (l.priority as Priority)
    : "Medium";
}

export function prank(l: Location): number {
  return { High: 0, Medium: 1, Low: 2, "Back burner": 3 }[prio(l)];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmt(d?: string | null): string {
  if (!d) return "";
  const p = String(d).slice(0, 10).split("-");
  if (p.length !== 3) return d;
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Date and time for timestamps. Date-only values stay date-only. */
export function fmtDateTime(d?: string | null): string {
  if (!d) return "";
  const raw = String(d);
  if (!raw.includes("T")) return fmt(raw);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fmt(raw);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function days(d?: string | null): number | null {
  if (!d) return null;
  const t = new Date(today());
  const x = new Date(String(d).slice(0, 10));
  return Math.round((+x - +t) / 864e5);
}

export function daysSince(d?: string | null): number | null {
  if (!d) return null;
  return -days(d)!;
}

export function searching(l: Location): number | null {
  if (!l.searchSince) return null;
  if (l.stage === "6 - Open" || l.stage === "Dead") return null;
  return -days(l.searchSince)!;
}

export function addDays(start: string, n: number): string {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `loc-${Date.now()}`
  );
}

export function planProgress(
  p?: { tasks?: { status?: string }[] } | null,
): number | null {
  if (!p?.tasks?.length) return null;
  const live = p.tasks.filter((t) => t.status !== "N/A");
  if (!live.length) return 0;
  return Math.round(
    (live.filter((t) => t.status === "Done").length / live.length) * 100,
  );
}
