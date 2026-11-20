import { useEffect, useRef } from "react";

/** Pointer depth is decoration only and is disabled for touch and reduced motion. */
export function useSceneMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const allowed = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      scene.style.setProperty("--scene-x", "0deg");
      scene.style.setProperty("--scene-y", "0deg");
    };
    const move = (event: PointerEvent) => {
      if (!allowed.matches) return;
      const bounds = scene.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty("--scene-x", `${-y * 9}deg`);
        scene.style.setProperty("--scene-y", `${x * 9}deg`);
      });
    };
    scene.addEventListener("pointermove", move);
    scene.addEventListener("pointerleave", reset);
    allowed.addEventListener("change", reset);
    return () => {
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", reset);
      allowed.removeEventListener("change", reset);
      reset();
    };
  }, []);
  return ref;
}
