"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import {
  FOCUS,
  SHORT,
  STAGES,
  days,
  daysSince,
  prio,
  prank,
  searching,
  today,
} from "./constants";
import { isAdminRole } from "@/lib/roles";
import { DEFAULT_LAUNCH_TEMPLATE } from "./seed";
import type {
  FocusKey,
  LaunchPlan,
  LaunchTemplate,
  Location,
  UiState,
  Update,
  ViewMode,
} from "./types";

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

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
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
  const toastTimer = useRef<number | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const { data: session, status } = useSession();

  const isAdmin = isAdminRole(session?.user?.role);
  const canWrite = isAdmin || session?.user?.role === "agent";
  const me = session?.user?.name || "You";
  const ready = dataReady && status !== "loading";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }, []);

  const loadTracker = useCallback(async () => {
    const data = await api<{
      locations: Location[];
      updates: Update[];
      plans: Record<string, LaunchPlan>;
      template: LaunchTemplate;
    }>("/api/tracker");
    setLocations(data.locations);
    setUpdates(data.updates);
    setPlans(data.plans || {});
    setTemplate(data.template || DEFAULT_LAUNCH_TEMPLATE);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadTracker();
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          showToast("Failed to load from database");
        }
      } finally {
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTracker, showToast]);

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
        if (
          ui.focus &&
          FOCUS[ui.focus as Exclude<FocusKey, "">] &&
          !FOCUS[ui.focus as Exclude<FocusKey, "">].fn(l)
        )
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
      try {
        const { update } = await api<{ update: Update }>("/api/updates", {
          method: "POST",
          body: JSON.stringify({ locId, text }),
        });
        setUpdates((prev) => [update, ...prev]);
        setLocations((prev) =>
          prev.map((x) =>
            x.id === locId
              ? {
                  ...x,
                  lastTouched: today(),
                  ...(isAdmin ? { lastUpdatedBy: me } : {}),
                }
              : x,
          ),
        );
        if (!quiet) showToast("Update posted");
        return true;
      } catch (error) {
        console.error(error);
        showToast("Failed to post update");
        return false;
      }
    },
    [canWrite, isAdmin, me, showToast],
  );

  const saveLocation = useCallback(
    async (id: string, patch: Partial<Location>, logText?: string) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      const next = {
        ...patch,
        lastTouched: today(),
        ...(isAdmin ? { lastUpdatedBy: me } : {}),
      };
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...next } : l)),
      );
      try {
        const result = await api<{ location: Location; update?: Update }>(
          `/api/locations/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ patch, logText }),
          },
        );
        setLocations((prev) =>
          prev.map((l) => (l.id === id ? { ...l, ...result.location } : l)),
        );
        if (result.update) {
          setUpdates((prev) => [result.update!, ...prev]);
        }
        showToast("Saved");
      } catch (error) {
        console.error(error);
        showToast("Failed to save");
        try {
          await loadTracker();
        } catch {
          /* ignore */
        }
      }
    },
    [canWrite, isAdmin, loadTracker, me, showToast],
  );

  const addLocation = useCallback(
    async (name: string) => {
      if (!isAdmin) {
        showToast("Only an admin can add a location");
        return null;
      }
      try {
        const { location } = await api<{ location: Location }>("/api/locations", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setLocations((prev) => {
          if (prev.some((x) => x.id === location.id)) {
            return prev.map((x) => (x.id === location.id ? location : x));
          }
          return [...prev, location];
        });
        showToast("Location added");
        return location.id;
      } catch (error) {
        console.error(error);
        showToast("Failed to add location");
        return null;
      }
    },
    [isAdmin, showToast],
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      if (!isAdmin) {
        showToast("Only an admin can delete a location");
        return;
      }
      try {
        await api(`/api/locations/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setLocations((prev) => prev.filter((x) => x.id !== id));
        setPlans((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setUpdates((prev) => prev.filter((u) => u.locId !== id));
        setOpenId(null);
        showToast("Deleted");
      } catch (error) {
        console.error(error);
        showToast("Failed to delete");
      }
    },
    [isAdmin, showToast],
  );

  const savePlan = useCallback(
    async (id: string, patch: Partial<LaunchPlan>) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      const current = plans[id];
      if (!current) return;
      const nextPlan = { ...current, ...patch };
      setPlans((prev) => ({ ...prev, [id]: nextPlan }));
      try {
        const { plan } = await api<{ plan: LaunchPlan }>(
          `/api/plans/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            body: JSON.stringify({ plan: nextPlan }),
          },
        );
        setPlans((prev) => ({ ...prev, [id]: plan }));
        showToast("Saved");
      } catch (error) {
        console.error(error);
        showToast("Failed to save plan");
        try {
          await loadTracker();
        } catch {
          /* ignore */
        }
      }
    },
    [canWrite, loadTracker, plans, showToast],
  );

  const startPlan = useCallback(
    async (id: string, start: string) => {
      if (!canWrite) {
        showToast("You have view-only access");
        return;
      }
      try {
        const { plan } = await api<{ plan: LaunchPlan }>(
          `/api/plans/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            body: JSON.stringify({ action: "start", start }),
          },
        );
        setPlans((prev) => ({ ...prev, [id]: plan }));
        showToast("Plan started");
      } catch (error) {
        console.error(error);
        showToast("Failed to start plan");
      }
    },
    [canWrite, showToast],
  );

  const saveTemplateFromPlan = useCallback(
    async (id: string) => {
      if (!isAdmin) {
        showToast("Only an admin can save the default plan");
        return;
      }
      try {
        const { template: next } = await api<{ template: LaunchTemplate }>(
          "/api/template",
          {
            method: "PUT",
            body: JSON.stringify({ locationId: id }),
          },
        );
        setTemplate(next);
        showToast("Saved as the default plan");
      } catch (error) {
        console.error(error);
        showToast("Failed to save template");
      }
    },
    [isAdmin, showToast],
  );

  const resetData = useCallback(() => {
    void (async () => {
      try {
        await loadTracker();
        showToast("Reloaded from database");
      } catch {
        showToast("Failed to reload");
      }
    })();
  }, [loadTracker, showToast]);

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
        k: "Lease at risk",
        hard: false,
        watch: false,
        why: "Lease health is on watch or at risk.",
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
    const weeklyStages = STAGES.filter((s) => s !== "6 - Open");
    const active = locations.filter((l) => l.stage && l.stage !== "6 - Open");
    out += `SITES NOT OPEN (${active.length})\n`;
    if (!active.length) {
      out += "Every site is open.\n";
    } else {
      weeklyStages.forEach((s) => {
        const items = locations.filter((l) => l.stage === s);
        if (!items.length) return;
        out += `\n${SHORT[s]} (${items.length})\n`;
        items
          .slice()
          .sort(
            (a, b) =>
              prank(a) - prank(b) ||
              (searching(b) ?? -1) - (searching(a) ?? -1) ||
              a.name.localeCompare(b.name),
          )
          .forEach((l) => {
            const sd = searching(l);
            const place = [l.city, l.state].filter(Boolean).join(", ");
            out += `  - ${l.name}${prio(l) === "High" ? " [HIGH]" : ""}${sd !== null ? ` — searching ${sd} days` : ""}${place ? ` (${place})` : ""}\n`;
          });
      });
    }
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
    hydrated: ready,
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
