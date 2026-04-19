import React, { createContext, useContext, useState } from 'react';
import translations from './i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('skyjo_lang') || 'en';
  });

  const t = translations[lang] || translations.en;

  const setLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('skyjo_lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
