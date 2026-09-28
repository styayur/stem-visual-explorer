import { useEffect, useState } from "react";
import { translateInstant, translateText, type TranslationProvider } from "./engine";

export interface TranslatedText {
  text: string;
  provider: TranslationProvider;
}

/**
 * Lazily translate a string in the background. Instantly resolves cached /
 * glossary hits, otherwise asks the translation service and updates on arrival.
 */
export function useTranslatedText(
  text: string | null | undefined,
  enabled: boolean,
  target: string
): TranslatedText | null {
  const [state, setState] = useState<TranslatedText | null>(null);

  useEffect(() => {
    if (!enabled || !text || !text.trim()) {
      setState(null);
      return;
    }
    const instant = translateInstant(text, target);
    if (instant) {
      setState(instant);
      return;
    }
    let cancelled = false;
    translateText(text, target)
      .then((r) => {
        if (!cancelled) setState(r);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text, enabled, target]);

  return state;
}