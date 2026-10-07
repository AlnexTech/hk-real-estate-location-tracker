export type Stage =
  | "1 - Market (No Site)"
  | "2 - Site Search"
  | "3 - LOI"
  | "4 - Lease"
  | "5 - Under Construction"
  | "6 - Open"
  | "On Hold"
  | "Dead";

export type Health = "" | "Green" | "Yellow" | "Red";
export type Priority = "High" | "Normal" | "Back burner";
export type TaskStatus = "Not Started" | "In Progress" | "Done" | "N/A";
export type ViewMode = "board" | "table" | "plan";
export type FocusKey =
  | ""
  | "open"
  | "pipeline"
  | "high"
  | "loilease"
  | "build"
  | "flag"
  | "late"
  | "searching";

export interface Location {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  ownership?: string;
  format?: string;
  sqft?: number | string;
  address?: string;
  landlord?: string;
  stage?: Stage | string;
  health?: Health | string;
  priority?: Priority | string;
  searchSince?: string;
  loiStatus?: string;
  loiSent?: string;
  loiSigned?: string;
  leaseDraft?: string;
  leaseAttorney?: string;
  leaseSigned?: string;
  rentStart?: string;
  freeRent?: number | string;
  ti?: number | string;
  baseRent?: number | string;
  nnn?: number | string;
  fddSigned?: string;
  targetOpen?: string;
  actualOpen?: string;
  notesMfi?: string;
  notes?: string;
  drive?: string;
  lastTouched?: string;
  updatedAt?: string;
}

export interface Update {
  id: string;
  locId: string;
  locName: string;
  text: string;
  at: string;
  by: string;
  ts: number;
}

export interface PlanTask {
  tid: string;
  phase: string;
  task: string;
  owner: string;
  s: number;
  e: number;
  crit: boolean;
  status?: TaskStatus;
}

export interface LaunchPlan {
  start: string;
  tasks: PlanTask[];
}

export interface LaunchTemplate {
  name: string;
  days: number;
  tasks: Omit<PlanTask, "status">[];
}

export interface UiState {
  view: ViewMode;
  q: string;
  country: string;
  health: string;
  prio: string;
  hideOpen: boolean;
  focus: FocusKey;
}

export type FieldDef =
  | ["sec", string]
  | [string, string, "text" | "number" | "date" | "textarea", "full"?]
  | [string, string, "select", string[]];
