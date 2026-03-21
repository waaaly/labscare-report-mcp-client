'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { i18nConfig } from './config';

import commonEn from '@/public/locales/en/common.json';
import dashboardEn from '@/public/locales/en/dashboard.json';
import navigationEn from '@/public/locales/en/navigation.json';
import commonZh from '@/public/locales/zh/common.json';
import dashboardZh from '@/public/locales/zh/dashboard.json';
import navigationZh from '@/public/locales/zh/navigation.json';

const resources = {
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    navigation: navigationEn,
  },
  zh: {
    common: commonZh,
    dashboard: dashboardZh,
    navigation: navigationZh,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: 'common',
    fallbackNS: i18nConfig.fallbackNS,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
