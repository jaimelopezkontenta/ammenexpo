import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { useColorScheme } from "nativewind";

import {
  parseThemePref,
  THEME_STORAGE_KEY,
  type ThemePref,
} from "./preference";

type ThemeContextValue = {
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyWebClass(pref: ThemePref) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", pref === "dark");
  document.documentElement.classList.toggle("light", pref === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>(() => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
    }
    return "system";
  });

  useEffect(() => {
    if (Platform.OS === "web") return;
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((value) => {
      setPrefState(parseThemePref(value));
    });
  }, []);

  useEffect(() => {
    try {
      setColorScheme(pref);
    } catch {
      // NativeWind lanza si darkMode sigue en "media"; el plugin de
      // tailwind.config ya es "class". Si un test no carga NativeWind, no
      // tumba la app.
    }
    applyWebClass(pref);
  }, [pref, setColorScheme]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    applyWebClass(next);
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return;
    }
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ pref, setPref }), [pref, setPref]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemePref(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemePref must be used within ThemeProvider");
  }
  return ctx;
}
