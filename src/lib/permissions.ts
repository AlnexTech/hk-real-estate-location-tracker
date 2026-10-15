import { FIELDS } from "@/lib/constants";
import type { Location } from "@/lib/types";

/** Every location-form field, plus the location name. Deletes stay admin-only. */
const AGENT_LOCATION_KEYS = new Set<string>([
  "name",
  ...FIELDS.filter((field) => field[0] !== "sec").map((field) => field[0]),
]);

export function agentMayPatchLocation(patch: Partial<Location>): boolean {
  return Object.keys(patch).every((key) => AGENT_LOCATION_KEYS.has(key));
}
