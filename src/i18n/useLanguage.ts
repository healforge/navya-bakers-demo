import { createContext, useContext } from 'react'
import { translate, type Language, type Translate } from './translations'

export interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Translate
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (message, values) => translate('en', message, values),
})

export function useLanguage() {
  return useContext(LanguageContext)
}
