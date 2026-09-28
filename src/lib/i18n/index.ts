import { useMemo } from "react";
import { DICTS, type Dict } from "./dict";
import type { UiLocale } from "../types";
import { useSettingsStore } from "../../stores/settingsStore";

export type TParams = Record<string, string | number>;

export function translate(locale: UiLocale, key: string, params?: TParams): string {
  const dict: Dict = DICTS[locale] ?? DICTS.en;
  let s = dict[key] ?? DICTS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/** React hook returning a translator bound to the current UI locale. */
export function useT() {
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  return useMemo(
    () => (key: string, params?: TParams) => translate(locale, key, params),
    [locale]
  );
}

export function typeLabelKey(resultType: string): string {
  return `type.${resultType}`;
}

export { UI_LOCALES } from "./dict";