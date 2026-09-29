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
  const [state, setState] = useState<{ original: string; target: string; result: TranslatedText } | null>(null);

  useEffect(() => {
    if (!enabled || !text || !text.trim()) {
      setState(null);
      return;
    }
    const instant = translateInstant(text, target);
    if (instant) {
      setState({ original: text, target, result: instant });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    translateText(text, target, undefined, controller.signal)
      .then((r) => {
        if (!cancelled) setState({ original: text, target, result: r });
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [text, enabled, target]);

  return enabled && state && state.original === text && state.target === target ? state.result : null;
}
