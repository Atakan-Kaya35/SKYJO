import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function LanguageToggle() {
  const { lang, setLanguage } = useLanguage();

  return (
    <div className="language-toggle">
      <button
        className={`lang-btn ${lang === 'en' ? 'lang-active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
      <button
        className={`lang-btn ${lang === 'tr' ? 'lang-active' : ''}`}
        onClick={() => setLanguage('tr')}
      >
        TR
      </button>
    </div>
  );
}
