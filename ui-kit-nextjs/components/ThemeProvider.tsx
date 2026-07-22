'use client';

// GlamBook — Fournisseur de thème (Sombre par défaut, bascule Clair persistée).
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'gb-theme';

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // Applique la classe `dark` sur <html>
  const apply = (t: Theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', t === 'dark');
    root.style.colorScheme = t;
  };

  useEffect(() => {
    let initial: Theme = defaultTheme;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'dark' || stored === 'light') initial = stored;
    } catch {}
    apply(initial);
    setThemeState(initial);
  }, [defaultTheme]);

  const setTheme = (t: Theme) => {
    apply(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    setThemeState(t);
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Script anti-flash (FOUC) : à injecter en <head> AVANT le rendu, via
 * <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} /> dans layout.tsx.
 */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'dark';var d=t==='dark';document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;
