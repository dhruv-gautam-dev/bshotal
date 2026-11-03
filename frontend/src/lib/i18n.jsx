// Internationalization context and translation dictionary for multi-language support
import React, { createContext, useContext, useState } from 'react'

export const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState('en')
  const t = (key) => key

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children || <div>I18n</div>}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  return context || { locale: 'en', setLocale: () => {}, t: (key) => key }
}

export default function I18n() {
  return <div>I18n</div>
}

