import { z } from "zod";

export const preferenceOptions = {
  color: ["violet", "rose", "blue", "green", "amber"],
  font: ["manrope", "arial", "georgia", "mono"],
  shape: ["rounded", "soft", "crisp"],
} as const;

export const preferenceSchema = z.object({
  color: z.enum(preferenceOptions.color).default("green"),
  font: z.enum(preferenceOptions.font).default("manrope"),
  shape: z.enum(preferenceOptions.shape).default("rounded"),
  sound: z.boolean().default(true),
  vibration: z.boolean().default(false),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences = preferenceSchema.parse({});
export function parsePreferences(value: unknown): Preferences {
  const result = preferenceSchema.safeParse(value);
  return result.success ? result.data : { ...defaultPreferences };
}
export function preferenceChanges(before: Preferences, after: Preferences) {
  return (Object.keys(defaultPreferences) as (keyof Preferences)[]).filter(
    (key) => before[key] !== after[key],
  );
}

/** Keep unrelated edits when another control commits a preference. */
export function rebasePreferences(draft: Preferences, before: Preferences, after: Preferences) {
  return {
    ...draft,
    ...Object.fromEntries(preferenceChanges(before, after).map((key) => [key, after[key]])),
  };
}
