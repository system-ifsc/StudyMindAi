import { useEffect, useRef } from "react";

/** Animate each surface once when it enters the viewport; content stays visible without JS. */
export function useReveal(section?: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.06 },
    );

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observe = () => {
      if (motionPreference.matches) {
        observer.disconnect();
        return;
      }
      root
        .querySelectorAll(
          ".study-panel:not([data-revealed]), .stat-card:not([data-revealed]), .study-shortcut:not([data-revealed]), .welcome-features article:not([data-revealed])",
        )
        .forEach((element) => observer.observe(element));
    };
    motionPreference.addEventListener("change", observe);
    observe();
    // Lazy sections and query results can mount after the route shell.
    const mutations = new MutationObserver(observe);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      motionPreference.removeEventListener("change", observe);
    };
  }, [section]);

  return ref;
}
