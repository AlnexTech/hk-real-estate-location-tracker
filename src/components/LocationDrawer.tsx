"use client";

import {
  SHORT,
  STATUS_FIELDS,
  fieldsForLocation,
  fmt,
  healthLabel,
  prio,
  today,
} from "@/lib/constants";
import { useTracker } from "@/lib/store";
import type { FieldDef, Location } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";
import { LocationReport } from "./LocationReport";
import { PromptModal } from "./Modal";

function FieldInput({
  def,
  loc,
  canWrite,
  isAdmin,
  onChange,
}: {
  def: FieldDef;
  loc: Location;
  canWrite: boolean;
  isAdmin: boolean;
  onChange: (key: string, value: string | number) => void;
}) {
  if (def[0] === "sec") {
    return <div className="sec">{def[1]}</div>;
  }
  const [key, label, type, extra] = def;
  const v = (loc as unknown as Record<string, unknown>)[key] ?? "";
  const cls = extra === "full" || type === "textarea" ? "f full" : "f";
  const mayEdit = isAdmin || STATUS_FIELDS.includes(key);
  const dis = !(canWrite && mayEdit);

  let input: ReactNode;
  if (type === "select") {
    const opts = (extra as string[]) || [];
    input = (
      <select
        value={String(v)}
        disabled={dis}
        onChange={(e) => onChange(key, e.target.value)}
      >
        {opts.map((o) => (
          <option key={o || "__empty"} value={o}>
            {key === "health" && o ? healthLabel(o) : o}
          </option>
        ))}
      </select>
    );
  } else if (type === "textarea") {
    input = (
      <textarea
        defaultValue={String(v)}
        key={`${loc.id}-${key}-${String(v)}`}
        disabled={dis}
        onBlur={(e) => {
          if (e.target.value !== String(v)) onChange(key, e.target.value);
        }}
      />
    );
  } else if (type === "date" || type === "number") {
    input = (
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "any" : undefined}
        value={String(v).slice(0, type === "date" ? 10 : 999)}
        disabled={dis}
        onKeyDown={
          type === "number"
            ? (e) => {
                if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
              }
            : undefined
        }
        onChange={(e) => {
          const raw = e.target.value;
          if (type === "number" && raw !== "" && !Number.isFinite(Number(raw))) return;
          onChange(key, type === "number" && raw !== "" ? Number(raw) : raw);
        }}
      />
    );
  } else {
    input = (
      <input
        type="text"
        defaultValue={String(v)}
        key={`${loc.id}-${key}-${String(v)}`}
        disabled={dis}
        onBlur={(e) => {
          if (e.target.value !== String(v)) onChange(key, e.target.value);
        }}
      />
    );
  }

  return (
    <div className={cls}>
      <label>{label}</label>
      {input}
    </div>
  );
}

export function LocationDrawer() {
  const {
    openId,
    setOpenId,
    locations,
    updates,
    plans,
    canWrite,
    isAdmin,
    saveLocation,
    postUpdate,
    deleteLocation,
    setPlanLoc,
    setUi,
  } = useTracker();

  const loc = locations.find((x) => x.id === openId);
  const [name, setName] = useState("");
  const [upText, setUpText] = useState("");
  const [posting, setPosting] = useState(false);
  const [delArmed, setDelArmed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [modal, setModal] = useState<{
    kind: "opened";
  } | null>(null);

  useEffect(() => {
    if (loc) {
      setName(loc.name || "");
      setUpText("");
      setDelArmed(false);
      setReportOpen(false);
    }
  }, [loc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reportOpen) {
        setReportOpen(false);
        return;
      }
      setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reportOpen, setOpenId]);

  if (!openId || !loc) return null;

  const hist = updates.filter((u) => u.locId === openId).slice(0, 20);

  const onField = (key: string, value: string | number) => {
    saveLocation(openId, { [key]: value });
  };

  return (
    <>
      <div
        className="drawer open"
        onClick={(e) => {
          if ((e.target as HTMLElement).id === "drawer-backdrop") setOpenId(null);
        }}
        id="drawer-backdrop"
        role="presentation"
      >
        <div className="drawer-panel" role="dialog" aria-modal="true">
          <div className="drawer-corner">
            <button
              type="button"
              className="btn report-launch"
              onClick={() => setReportOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3.5 1.5h6.2L13 4.8v9.7H3.5V1.5Zm5.6 1.2v2.6H11.7L9.1 2.7ZM4.8 2.8v10.4h7V7.2H8.4V2.8H4.8Zm1 4.2h4.4v1.1H5.8V7Zm0 2.2h4.4v1.1H5.8V9.2Zm0 2.2h3.1v1.1H5.8v-1.1Z"
                />
              </svg>
              Report
            </button>
            <button
              type="button"
              className="close"
              onClick={() => setOpenId(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <h2
            contentEditable={canWrite && isAdmin}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => {
              const v = e.currentTarget.textContent?.trim() || "";
              if (v && v !== loc.name) saveLocation(openId, { name: v });
              setName(v);
            }}
          >
            {name}
          </h2>
          <div className="sub">
            {SHORT[loc.stage || ""] || loc.stage || ""}
            {loc.health ? ` · ${healthLabel(loc.health)}` : ""}
          </div>

          <div className="quick">
            {loc.stage !== "6 - Open" ? (
              <button
                type="button"
                className="btn"
                disabled={!canWrite}
                onClick={() => setModal({ kind: "opened" })}
              >
                Mark opened
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={!canWrite}
                onClick={() =>
                  saveLocation(
                    openId,
                    { stage: "5 - Under Construction", actualOpen: "" },
                    "Moved back out of Open",
                  )
                }
              >
                Not open yet
              </button>
            )}
            {(loc.stage === "3 - LOI" || loc.stage === "4 - Lease") && (
              <button
                type="button"
                className="btn"
                disabled={!canWrite}
                onClick={() =>
                  saveLocation(
                    openId,
                    {
                      stage: "2 - Site Search",
                      loiStatus: "Dead",
                      loiSent: "",
                      loiSigned: "",
                      leaseDraft: "",
                      leaseAttorney: "",
                      leaseSigned: "",
                    },
                    "LOI fell through, back to site search",
                  )
                }
              >
                LOI fell through
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPlanLoc(openId);
                setUi({ view: "plan" });
                setOpenId(null);
              }}
            >
              Launch plan
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canWrite}
              onClick={() =>
                saveLocation(openId, {
                  priority: prio(loc) === "High" ? "Medium" : "High",
                })
              }
            >
              {prio(loc) === "High" ? "High priority ✓" : "Make high priority"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canWrite}
              onClick={() =>
                saveLocation(openId, {
                  priority:
                    prio(loc) === "Back burner" ? "Medium" : "Back burner",
                })
              }
            >
              {prio(loc) === "Back burner"
                ? "Back burner ✓"
                : "Back burner"}
            </button>
            {loc.stage !== "On Hold" ? (
              <button
                type="button"
                className="btn"
                disabled={!canWrite}
                onClick={() =>
                  saveLocation(openId, { stage: "On Hold" }, "Put on hold")
                }
              >
                Put on hold
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={!canWrite}
                onClick={() =>
                  saveLocation(
                    openId,
                    { stage: "2 - Site Search" },
                    "Back to site search",
                  )
                }
              >
                Back to site search
              </button>
            )}
          </div>

          <div className="field-grid">
            {fieldsForLocation(loc).map((f, i) => (
              <FieldInput
                key={f[0] === "sec" ? `sec-${f[1]}-${i}` : `${f[0]}-${i}`}
                def={f}
                loc={loc}
                canWrite={canWrite}
                isAdmin={isAdmin}
                onChange={onField}
              />
            ))}
            <div className="sec">Add an update</div>
            <div className="f full">
              <textarea
                placeholder="What changed? e.g. Landlord countered the LOI, waiting on Mike."
                value={upText}
                disabled={!canWrite}
                onChange={(e) => setUpText(e.target.value)}
              />
            </div>
            <div className="f full">
              <button
                type="button"
                className="btn primary"
                disabled={!canWrite || posting}
                onClick={async () => {
                  const t = upText.trim();
                  if (!t) return;
                  setPosting(true);
                  const ok = await postUpdate(openId, t);
                  setPosting(false);
                  if (ok) setUpText("");
                }}
              >
                {posting ? "Posting..." : "Post update"}
              </button>
            </div>
            <div className="f full">
              <div className="sec" style={{ marginTop: 2 }}>
                History
              </div>
              <div>
                {hist.length ? (
                  hist.map((u) => (
                    <div
                      key={u.id}
                      className="row"
                      style={{
                        padding: "6px 0",
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      {u.text}
                      <div className="who">
                        {fmt(u.at)} · {u.by || "Someone"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sub">Nothing logged yet.</div>
                )}
              </div>
            </div>
            <div className="f full" style={{ marginTop: 10 }}>
              {isAdmin ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={async () => {
                    if (!delArmed) {
                      setDelArmed(true);
                      setTimeout(() => setDelArmed(false), 5000);
                      return;
                    }
                    await deleteLocation(openId);
                  }}
                >
                  {delArmed
                    ? "Click again to delete for good"
                    : "Delete this location"}
                </button>
              ) : (
                <div className="sub">
                  Only an admin can delete a location.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {reportOpen ? (
        <LocationReport
          loc={loc}
          updates={updates.filter((u) => u.locId === openId)}
          plan={plans[openId]}
          onClose={() => setReportOpen(false)}
        />
      ) : null}

      <PromptModal
        open={modal?.kind === "opened"}
        title="Mark as opened"
        fields={[{ label: "Opening date", type: "date", value: today() }]}
        okLabel="Mark opened"
        onCancel={() => setModal(null)}
        onOk={async (r) => {
          setModal(null);
          if (!r[0]) return;
          await saveLocation(
            openId,
            {
              stage: "6 - Open",
              health: "Green",
              actualOpen: r[0],
              targetOpen: "",
            },
            `Opened ${fmt(r[0])}`,
          );
        }}
      />
    </>
  );
}
