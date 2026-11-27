import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type Language } from './translations'
import { LanguageContext, type LanguageContextValue } from './useLanguage'

const STORAGE_KEY = 'navya-erp:language'

function readLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ml' ? 'ml' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(readLanguage)
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (message, values) => translate(language, message, values),
  }), [language])

  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // The current selection still works when storage is unavailable.
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
