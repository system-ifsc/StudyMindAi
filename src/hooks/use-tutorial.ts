import { createContext, useContext } from "react";

export const TutorialContext = createContext<(() => void) | null>(null);

export function useTutorial() {
  const restart = useContext(TutorialContext);
  if (!restart) throw new Error("TutorialProvider ausente");
  return restart;
}
