"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FOCUS,
  days,
  daysSince,
  prio,
  prank,
  searching,
  slug,
  today,
} from "./constants";
import { DEFAULT_LAUNCH_TEMPLATE, SEED_LOCATIONS, SEED_UPDATES } from "./seed";
import type {
  FocusKey,
  LaunchPlan,
  LaunchTemplate,
  Location,
  UiState,
  Update,
  ViewMode,
} from "./types";

const STORAGE_KEY = "hk-re-tracker-v1";

interface Persisted {
  locations: Location[];
  updates: Update[];
  plans: Record<string, LaunchPlan>;
  template: LaunchTemplate;
}

interface TrackerContextValue {
  locations: Location[];
  updates: Update[];
  plans: Record<string, LaunchPlan>;
  template: LaunchTemplate;
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
  canWrite: boolean;
  isAdmin: boolean;
  me: string;
  hydrated: boolean;
  filtered: Location[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  planLoc: string;
  setPlanLoc: (id: string) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  saveLocation: (
    id: string,
    patch: Partial<Location>,
    logText?: string,
  ) => Promise<void>;
  addLocation: (name: string) => Promise<string | null>;
  deleteLocation: (id: string) => Promise<void>;
  postUpdate: (locId: string, text: string, quiet?: boolean) => Promise<boolean>;
  savePlan: (id: string, patch: Partial<LaunchPlan>) => Promise<void>;
  startPlan: (id: string, start: string) => Promise<void>;
  saveTemplateFromPlan: (id: string) => Promise<void>;
  resetData: () => void;
  digest: () => string;
  alertGroups: () => AlertGroup[];
}

export interface AlertGroup {
  id: string;
  k: string;
  hard: boolean;
  watch: boolean;
  why: string;
  items: Location[];
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return {
      locations: SEED_LOCATIONS,
      updates: SEED_UPDATES,
      plans: {},
      template: DEFAULT_LAUNCH_TEMPLATE,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed.locations?.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {
    locations: SEED_LOCATIONS,
    updates: SEED_UPDATES,
    plans: {},
    template: DEFAULT_LAUNCH_TEMPLATE,
  };
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [locations, setLocations] = useState<Location[]>(SEED_LOCATIONS);
  const [updates, setUpdates] = useState<Update[]>(SEED_UPDATES);
  const [plans, setPlans] = useState<Record<string, LaunchPlan>>({});
  const [template, setTemplate] = useState<LaunchTemplate>(
    DEFAULT_LAUNCH_TEMPLATE,
  );
  const [ui, setUiState] = useState<UiState>({
    view: "board",
    q: "",
    country: "",
    health: "",
    prio: "",
    hideOpen: false,
    focus: "",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [planLoc, setPlanLoc] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const canWrite = true;
  const isAdmin = true;
  const me = "You";

  useEffect(() => {
    const data = loadPersisted();
    setLocations(data.locations);
    setUpdates(data.updates);
    setPlans(data.plans || {});
    setTemplate(data.template || DEFAULT_LAUNCH_TEMPLATE);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: Persisted = { locations, updates, plans, template };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, locations, updates, plans, template]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  const setUi = useCallback((patch: Partial<UiState>) => {
    setUiState((prev) => ({ ...prev, ...patch }));
  }, []);

  const filtered = useMemo(() => {
    const q = ui.q.toLowerCase();
    return locations
      .filter((l) => {
        if (ui.country && l.country !== ui.country) return false;
        if (ui.health && l.health !== ui.health) return false;
        if (ui.prio && prio(l) !== ui.prio) return false;
        if (ui.focus && FOCUS[ui.focus as Exclude<FocusKey, "">] && !FOCUS[ui.focus as Exclude<FocusKey, "">].fn(l))
          return false;
        if (ui.hideOpen && l.stage === "6 - Open") return false;
        if (
          q &&
          !`${l.name || ""} ${l.city || ""} ${l.state || ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          prank(a) - prank(b) ||
          (searching(b) ?? -1) - (searching(a) ?? -1) ||
          (a.name || "").localeCompare(b.name || ""),
      );
  }, [locations, ui]);

  const postUpdate = useCallback(
    async (locId: string, text: string, quiet?: boolean) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return false;
      }
      const l = locations.find((x) => x.id === locId);
      const row: Update = {
        id: `u${Date.now()}`,
        locId,
        locName: l?.name || "",
        text,
        at: today(),
        by: me,
        ts: Date.now(),
      };
      setUpdates((prev) => [row, ...prev]);
      setLocations((prev) =>
        prev.map((x) =>
          x.id === locId ? { ...x, lastTouched: today() } : x,
        ),
      );
      if (!quiet) showToast("Update posted");
      return true;
    },
    [canWrite, locations, me, showToast],
  );

  const saveLocation = useCallback(
    async (id: string, patch: Partial<Location>, logText?: string) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      const next = { ...patch, lastTouched: today() };
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...next } : l)),
      );
      showToast("Saved");
      if (logText) await postUpdate(id, logText, true);
    },
    [canWrite, postUpdate, showToast],
  );

  const addLocation = useCallback(
    async (name: string) => {
      if (!isAdmin) {
        showToast("Only a super admin can add a location");
        return null;
      }
      const id = slug(name);
      const loc: Location = {
        id,
        name: name.trim(),
        stage: "2 - Site Search",
        country: "USA",
        ownership: "Franchise",
        priority: "Normal",
        lastTouched: today(),
      };
      setLocations((prev) => {
        if (prev.some((x) => x.id === id)) {
          return prev.map((x) => (x.id === id ? { ...x, ...loc } : x));
        }
        return [...prev, loc];
      });
      showToast("Added");
      return id;
    },
    [isAdmin, showToast],
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      if (!isAdmin) {
        showToast("Only a super admin can delete");
        return;
      }
      setLocations((prev) => prev.filter((x) => x.id !== id));
      setPlans((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setOpenId(null);
      showToast("Deleted");
    },
    [isAdmin, showToast],
  );

  const savePlan = useCallback(
    async (id: string, patch: Partial<LaunchPlan>) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      setPlans((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        return { ...prev, [id]: { ...cur, ...patch } };
      });
      showToast("Saved");
    },
    [canWrite, showToast],
  );

  const startPlan = useCallback(
    async (id: string, start: string) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      const doc: LaunchPlan = {
        start,
        tasks: template.tasks.map((t) => ({
          ...t,
          status: "Not Started" as const,
        })),
      };
      setPlans((prev) => ({ ...prev, [id]: doc }));
      showToast("Plan started");
    },
    [canWrite, showToast, template],
  );

  const saveTemplateFromPlan = useCallback(
    async (id: string) => {
      const p = plans[id];
      if (!p) return;
      setTemplate({
        name: template.name,
        days: template.days,
        tasks: p.tasks.map(({ status: _s, ...t }) => t),
      });
      showToast("Saved as the default plan");
    },
    [plans, showToast, template.days, template.name],
  );

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLocations(SEED_LOCATIONS);
    setUpdates(SEED_UPDATES);
    setPlans({});
    setTemplate(DEFAULT_LAUNCH_TEMPLATE);
    showToast("Reset to seed data");
  }, [showToast]);

  const alertGroups = useCallback((): AlertGroup[] => {
    const act = (l: Location) =>
      !!l.stage &&
      l.stage !== "6 - Open" &&
      l.stage !== "Dead" &&
      prio(l) !== "Back burner";
    const stale = (l: Location) => {
      const t = l.lastTouched || l.updatedAt;
      return t ? daysSince(t)! >= 21 : true;
    };
    const g: AlertGroup[] = [
      {
        id: "site",
        k: "Still looking for a site",
        hard: false,
        watch: true,
        why: "No property yet, and no update in the last 3 weeks.",
        items: locations
          .filter(
            (l) =>
              act(l) &&
              (l.stage === "1 - Market (No Site)" ||
                l.stage === "2 - Site Search") &&
              stale(l),
          )
          .sort(
            (a, b) =>
              prank(a) - prank(b) ||
              (searching(b) ?? -1) - (searching(a) ?? -1),
          ),
      },
      {
        id: "late",
        k: "Opening date has passed",
        hard: true,
        watch: false,
        why: "These were supposed to be open and still are not.",
        items: locations.filter(
          (l) =>
            act(l) &&
            l.targetOpen &&
            !l.actualOpen &&
            days(l.targetOpen)! < 0,
        ),
      },
      {
        id: "loi",
        k: "Waiting on a signed letter",
        hard: false,
        watch: false,
        why: "The letter of intent went out more than a month ago.",
        items: locations.filter(
          (l) =>
            act(l) &&
            l.loiSent &&
            !l.loiSigned &&
            daysSince(l.loiSent)! >= 30,
        ),
      },
      {
        id: "flag",
        k: "Marked at risk",
        hard: false,
        watch: false,
        why: "The team flagged these red or yellow.",
        items: locations.filter(
          (l) => l.health === "Red" || l.health === "Yellow",
        ),
      },
      {
        id: "build",
        k: "Building, no opening date",
        hard: false,
        watch: false,
        why: "A lease is signed and there is still no target open date.",
        items: locations.filter(
          (l) => act(l) && l.leaseSigned && !l.targetOpen,
        ),
      },
    ];
    return g.filter((x) => x.items.length);
  }, [locations]);

  const digest = useCallback(() => {
    const d = new Date().toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    let out = `Hyper Kidz pipeline — week of ${d}\n\n`;
    const stages = [
      "2 - Site Search",
      "3 - LOI",
      "4 - Lease",
      "5 - Under Construction",
      "6 - Open",
      "1 - Market (No Site)",
      "On Hold",
      "Dead",
    ];
    const SHORT: Record<string, string> = {
      "1 - Market (No Site)": "Market",
      "2 - Site Search": "Site Search",
      "3 - LOI": "LOI",
      "4 - Lease": "Lease Negotiation",
      "5 - Under Construction": "Under Construction",
      "6 - Open": "Open",
      "On Hold": "On Hold",
      Dead: "Dead",
    };
    stages.forEach((s) => {
      const n = locations.filter((l) => l.stage === s).length;
      if (n) out += `${SHORT[s]}: ${n}\n`;
    });
    out += `\nALERTS\n`;
    const gs = alertGroups();
    if (!gs.length) out += "Nothing flagged.\n";
    gs.forEach((g) => {
      out += `\n${g.k} (${g.items.length}) — ${g.why}\n`;
      g.items.forEach((l) => {
        const sd = searching(l);
        out += `  - ${l.name}${prio(l) === "High" ? " [HIGH]" : ""}${sd !== null ? ` — searching ${sd} days` : ""}${l.city ? ` (${l.city}, ${l.state || ""})` : ""}\n`;
      });
    });
    const recent = updates.slice(0, 10);
    if (recent.length) {
      out += `\nRECENT UPDATES\n`;
      recent.forEach((u) => {
        const l = locations.find((x) => x.id === u.locId);
        out += `  - ${l ? l.name : u.locName}: ${u.text} (${u.at})\n`;
      });
    }
    return out;
  }, [alertGroups, locations, updates]);

  const value: TrackerContextValue = {
    locations,
    updates,
    plans,
    template,
    ui,
    setUi,
    canWrite,
    isAdmin,
    me,
    hydrated,
    filtered,
    openId,
    setOpenId,
    planLoc,
    setPlanLoc,
    toast,
    showToast,
    saveLocation,
    addLocation,
    deleteLocation,
    postUpdate,
    savePlan,
    startPlan,
    saveTemplateFromPlan,
    resetData,
    digest,
    alertGroups,
  };

  return (
    <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
  );
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used within TrackerProvider");
  return ctx;
}

export function useSetView(view: ViewMode) {
  const { setUi } = useTracker();
  return () => setUi({ view });
}
