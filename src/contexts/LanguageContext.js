import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';

const LanguageContext = createContext();

// English ships in the entry bundle (it's also the per-key fallback); the
// other seven load on demand so ~400KB of translations stay out of the
// initial chunk. Vite code-splits the dynamic import below per language.
const translations = { en };

const loadLanguage = async (code) => {
  if (translations[code]) return translations[code];
  const mod = await import(`../translations/${code}.js`);
  translations[code] = mod.default;
  return translations[code];
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get saved language from localStorage or default to English
    return localStorage.getItem('appLanguage') || 'en';
  });
  // Bumped when an async language file lands so consumers re-render.
  const [, setLoadedTick] = useState(0);

  useEffect(() => {
    // Save language preference to localStorage
    localStorage.setItem('appLanguage', language);
  }, [language]);

  useEffect(() => {
    if (translations[language]) return;
    let cancelled = false;
    loadLanguage(language)
      .then(() => { if (!cancelled) setLoadedTick((n) => n + 1); })
      .catch(() => {}); // stay on the EN fallback if the chunk fails
    return () => { cancelled = true; };
  }, [language]);

  const t = (key, vars) => {
    const keys = key.split('.');
    // Until the language chunk arrives, translations[language] is undefined
    // and every key falls through to English below.
    let translation = translations[language];

    for (const k of keys) {
      translation = translation?.[k];
    }

    // If translation not found, try English as fallback
    if (!translation) {
      let fallback = translations.en;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      translation = fallback || key;
    }

    // {{var}} interpolation: t('trial.daysRemaining', { n: 3 })
    if (vars && typeof translation === 'string') {
      translation = translation.replace(/\{\{(\w+)\}\}/g, (m, name) =>
        vars[name] !== undefined ? String(vars[name]) : m
      );
    }

    return translation;
  };

  const changeLanguage = (newLanguage) => {
    if (availableLanguages.some((l) => l.code === newLanguage)) {
      setLanguage(newLanguage);
    }
  };

  // Same set as torahub.io. nativeName is what users see in the picker.
  const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' }
  ];

  const value = {
    language,
    t,
    changeLanguage,
    availableLanguages
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
