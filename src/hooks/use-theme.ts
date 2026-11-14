import { useEffect, useState } from "react";

const KEY = "studymind-theme";
/** Script inline (no <head>) aplica o tema antes da pintura para evitar flash. */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(KEY, next ? "dark" : "light");
    setDark(next);
  };
  return { dark, toggle };
}
