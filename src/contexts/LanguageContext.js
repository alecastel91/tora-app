import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';
import ja from '../translations/ja';
import zh from '../translations/zh';
import ko from '../translations/ko';
import es from '../translations/es';
import fr from '../translations/fr';
import it from '../translations/it';
import pt from '../translations/pt';

const LanguageContext = createContext();

// Missing keys in any language fall back to English (see t below), so a
// partially-translated file degrades gracefully rather than breaking.
const translations = { en, ja, zh, ko, es, fr, it, pt };

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

  useEffect(() => {
    // Save language preference to localStorage
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const t = (key, vars) => {
    const keys = key.split('.');
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
    if (translations[newLanguage]) {
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