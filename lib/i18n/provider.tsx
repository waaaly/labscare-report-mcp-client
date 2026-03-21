'use client';

import { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './client';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
