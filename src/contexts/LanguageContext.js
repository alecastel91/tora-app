import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';
import ja from '../translations/ja';

const LanguageContext = createContext();

const translations = {
  en: en,
  ja: ja
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

  const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' }
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