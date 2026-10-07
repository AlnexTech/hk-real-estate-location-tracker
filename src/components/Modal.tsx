"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      className="drawer open"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className={className ? `mbox ${className}` : "mbox"} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function PromptModal({
  open,
  title,
  fields,
  okLabel,
  onCancel,
  onOk,
}: {
  open: boolean;
  title: string;
  fields: { label: string; type?: string; value?: string }[];
  okLabel: string;
  onCancel: () => void;
  onOk: (values: string[]) => void;
}) {
  const [values, setValues] = useState<string[]>([]);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValues(fields.map((f) => f.value || ""));
      setTimeout(() => {
        firstRef.current?.focus();
        firstRef.current?.select();
      }, 40);
    }
  }, [open, fields]);

  return (
    <Modal open={open} onClose={onCancel}>
      <h3>{title}</h3>
      {fields.map((f, i) => (
        <div className="f" style={{ marginTop: 8 }} key={f.label}>
          <label>{f.label}</label>
          <input
            ref={i === 0 ? firstRef : undefined}
            type={f.type || "text"}
            value={values[i] ?? ""}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              setValues(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOk(values.map((v) => v.trim()));
            }}
          />
        </div>
      ))}
      <div className="mrow">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => onOk(values.map((v) => v.trim()))}
        >
          {okLabel}
        </button>
      </div>
    </Modal>
  );
}
