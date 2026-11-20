import { useEffect, useState } from "react";

const KEY = "studymind-theme";
/** Script inline (no <head>) aplica o tema antes da pintura para evitar flash. */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("studymind-theme", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("studymind-theme", sync);
    };
  }, []);
  const setTheme = (next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    window.dispatchEvent(new Event("studymind-theme"));
  };
  return {
    dark,
    toggle: () => setTheme(!document.documentElement.classList.contains("dark")),
    setTheme,
  };
}
