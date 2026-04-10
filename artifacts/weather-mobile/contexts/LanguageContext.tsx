import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { T, type Language, type TranslationKey } from "@/constants/translationsV2";

interface LanguageContextValue {
  language: Language;
  toggle: () => void;
  t: (key: TranslationKey) => string;
  tf: (key: TranslationKey, vars: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  toggle: () => {},
  t: (key) => T.en[key],
  tf: (key, vars) =>
    Object.entries(vars).reduce(
      (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value)),
      T.en[key] as string,
    ),
});

const STORAGE_KEY = "microclimate_language_v1";
const CYCLE: Language[] = ["en", "sw", "ki"];

const LANG_LABELS: Record<Language, string> = {
  en: "EN",
  sw: "SW",
  ki: "KI",
};

export { LANG_LABELS };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "sw" || val === "en" || val === "ki") setLanguage(val);
    });
  }, []);

  const toggle = useCallback(() => {
    setLanguage((prev) => {
      const idx = CYCLE.indexOf(prev);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => T[language][key] as string,
    [language]
  );

  const tf = useCallback(
    (key: TranslationKey, vars: Record<string, string | number>): string =>
      Object.entries(vars).reduce(
        (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value)),
        T[language][key] as string,
      ),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, toggle, t, tf }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
