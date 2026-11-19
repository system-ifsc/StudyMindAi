import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const SOUND_KEY = "studymind-click-sound";
const CONTROLS =
  'button, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], input[type="checkbox"], input[type="radio"], select';

/** Audio is synthesized locally and starts only after a user interaction. */
export function InteractionFeedback() {
  const [enabled, setEnabled] = useState(true);
  const audio = useRef<AudioContext | null>(null);
  const lastClick = useRef(0);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      /* Storage is optional. */
    }
    return () => {
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    function feedback(event: MouseEvent) {
      if (!(event.target instanceof Element) || event.button !== 0) return;
      const control = event.target.closest<HTMLElement>(CONTROLS);
      if (
        !control ||
        control.closest('[disabled], [aria-disabled="true"], [inert], [data-sound-toggle]')
      )
        return;
      const now = performance.now();
      if (now - lastClick.current < 70) return;
      lastClick.current = now;

      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const glow = getComputedStyle(control).getPropertyValue("--ring").trim();
        control.animate?.(
          [
            { outline: `2px solid ${glow}`, outlineOffset: "0px" },
            { outline: "2px solid transparent", outlineOffset: "7px" },
          ],
          { duration: 320, easing: "ease-out" },
        );
      }
      if (!enabled) return;
      try {
        if (!window.AudioContext) return;
        const context = audio.current ?? (audio.current = new AudioContext());
        const play = () => {
          if (context.state !== "running") return;
          const start = context.currentTime;
          const gain = context.createGain();
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.035, start + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
          gain.connect(context.destination);
          const tone = context.createOscillator();
          tone.type = "sine";
          tone.frequency.setValueAtTime(880, start);
          tone.frequency.exponentialRampToValueAtTime(520, start + 0.1);
          tone.connect(gain);
          tone.onended = () => {
            tone.disconnect();
            gain.disconnect();
          };
          tone.start(start);
          tone.stop(start + 0.13);
        };
        if (context.state === "suspended")
          void context
            .resume()
            .then(play)
            .catch(() => {});
        else play();
      } catch {
        /* Unsupported or blocked audio must never interrupt navigation. */
      }
    }
    document.addEventListener("click", feedback, true);
    return () => document.removeEventListener("click", feedback, true);
  }, [enabled]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      /* Storage is optional. */
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-sound-toggle
      className="glass-floating fixed bottom-24 right-3 z-40 h-11 w-11 rounded-full border shadow-card md:bottom-3"
      aria-label={enabled ? "Silenciar sons de clique" : "Ativar sons de clique"}
      aria-pressed={enabled}
      title={enabled ? "Silenciar sons de clique" : "Ativar sons de clique"}
      onClick={toggle}
    >
      {enabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
    </Button>
  );
}
