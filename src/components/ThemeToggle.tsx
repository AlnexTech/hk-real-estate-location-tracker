"use client";

import { useTheme, type Theme } from "@/lib/theme";

const ORDER: Theme[] = ["system", "light", "dark"];

const LABELS: Record<Theme, string> = {
  system: "Match system appearance",
  light: "Light theme",
  dark: "Dark theme",
};

function Icon({ theme }: { theme: Theme }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="seg theme-toggle" role="group" aria-label="Color theme">
      {ORDER.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          aria-label={LABELS[t]}
          title={LABELS[t]}
          onClick={() => setTheme(t)}
        >
          <Icon theme={t} />
        </button>
      ))}
    </div>
  );
}
