import type { Location } from "@/lib/types";

/** Fields a real estate agent can change. Admins can change every field. */
const AGENT_LOCATION_KEYS = new Set<string>([
  "stage",
  "health",
  "priority",
  "actualOpen",
  "targetOpen",
  "loiStatus",
  "loiSent",
  "loiSigned",
  "leaseDraft",
  "leaseAttorney",
  "leaseSigned",
]);

export function agentMayPatchLocation(patch: Partial<Location>): boolean {
  return Object.keys(patch).every((key) => AGENT_LOCATION_KEYS.has(key));
}
