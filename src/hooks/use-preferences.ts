import {
  defaultPreferences,
  preferenceOptions,
  parsePreferences,
  type Preferences,
} from "@/lib/core/preferences";

export const PREFERENCE_KEY = "studymind-preferences";
export function readPreferences() {
  try {
    const prefs = parsePreferences(JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}"));
    const legacySound = localStorage.getItem("studymind-click-sound");
    if (legacySound === "on" || legacySound === "off") prefs.sound = legacySound === "on";
    return prefs;
  } catch {
    return parsePreferences({});
  }
}
export function applyPreferences(prefs: Preferences) {
  const root = document.documentElement;
  root.dataset["color"] = prefs.color;
  root.dataset["font"] = prefs.font;
  delete root.dataset["textSize"];
  root.dataset["shape"] = prefs.shape;
}
export function savePreferences(prefs: Preferences, dark?: boolean) {
  const writes: [string, string][] = [
    [PREFERENCE_KEY, JSON.stringify(prefs)],
    ["studymind-click-sound", prefs.sound ? "on" : "off"],
  ];
  if (dark !== undefined) writes.push(["studymind-theme", dark ? "dark" : "light"]);
  const previous = writes.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, value] of writes) localStorage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // A browser may revoke storage access while saving.
      }
    }
    throw error;
  }
  applyPreferences(prefs);
  if (dark !== undefined) {
    document.documentElement.classList.toggle("dark", dark);
    window.dispatchEvent(new Event("studymind-theme"));
  }
  window.dispatchEvent(new Event("studymind-preferences"));
}
export const preferencesInitScript = `(()=>{var p={};try{p=JSON.parse(localStorage.getItem("${PREFERENCE_KEY}")||"{}")}catch(e){}var defaults=${JSON.stringify(defaultPreferences)};var options=${JSON.stringify(preferenceOptions)};if(!p||typeof p!=="object"||Array.isArray(p)||!Object.keys(defaults).every(k=>p[k]===undefined||(options[k]?options[k].includes(p[k]):typeof p[k]==="boolean")))p={};var r=document.documentElement;delete r.dataset.textSize;for(var k of Object.keys(options))r.dataset[k]=p[k]===undefined?defaults[k]:p[k]})()`;
