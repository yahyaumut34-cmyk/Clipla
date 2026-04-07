/**
 * usePlan — Free/Pro plan yönetimi
 *
 * Şimdilik lokal AsyncStorage tabanlı (backend entegrasyonu için genişletilebilir).
 *
 * Arayüz:
 *   const { plan, canUpload, canUseEffects, canUseAdvancedSubtitles, canGenerateShorts,
 *           uploadsRemaining, upgrade, restore } = usePlan();
 *
 * Free limitleri:
 *   - Günde 2 video yükleme
 *   - Efektler yok
 *   - Sadece TR/EN altyazı
 *   - Shorts yok
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_DAILY_UPLOADS = 2;
const PRO_ADVANCED_SUBTITLE_LANGS = ['de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ar'];
const BASIC_SUBTITLE_LANGS = ['tr', 'en'];

const KEY_PLAN      = 'cliplav_plan';          // 'free' | 'pro'
const KEY_UPLOADS   = 'cliplav_daily_uploads'; // { date: 'YYYY-MM-DD', count: N }

function todayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export function usePlan() {
  const [plan, setPlan]               = useState('free'); // 'free' | 'pro'
  const [dailyUploads, setDailyUploads] = useState(0);
  const [loaded, setLoaded]           = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [storedPlan, storedUploads] = await Promise.all([
          AsyncStorage.getItem(KEY_PLAN),
          AsyncStorage.getItem(KEY_UPLOADS),
        ]);
        if (storedPlan) setPlan(storedPlan);

        if (storedUploads) {
          const parsed = JSON.parse(storedUploads);
          if (parsed.date === todayStr()) {
            setDailyUploads(parsed.count || 0);
          } else {
            // Gün değişmiş — sıfırla
            await AsyncStorage.setItem(KEY_UPLOADS, JSON.stringify({ date: todayStr(), count: 0 }));
            setDailyUploads(0);
          }
        }
      } catch(e) {
        console.warn('[usePlan] load error:', e);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  const recordUpload = useCallback(async () => {
    const newCount = dailyUploads + 1;
    setDailyUploads(newCount);
    try {
      await AsyncStorage.setItem(KEY_UPLOADS, JSON.stringify({ date: todayStr(), count: newCount }));
    } catch(e) {
      console.warn('[usePlan] recordUpload error:', e);
    }
  }, [dailyUploads]);

  const upgrade = useCallback(async () => {
    // Gerçek bir ödeme akışı burada tetiklenebilir.
    // Şimdilik: simüle et.
    setPlan('pro');
    try {
      await AsyncStorage.setItem(KEY_PLAN, 'pro');
    } catch(e) {
      console.warn('[usePlan] upgrade error:', e);
    }
  }, []);

  const downgrade = useCallback(async () => {
    setPlan('free');
    try {
      await AsyncStorage.setItem(KEY_PLAN, 'free');
    } catch(e) {
      console.warn('[usePlan] downgrade error:', e);
    }
  }, []);

  const restore = useCallback(async () => {
    // Satın alımları geri yükle (gerçek: RevenueCat / StoreKit)
    // Şimdilik AsyncStorage'dan oku
    const storedPlan = await AsyncStorage.getItem(KEY_PLAN);
    if (storedPlan === 'pro') setPlan('pro');
  }, []);

  const isPro = plan === 'pro';

  const uploadsRemaining = isPro ? Infinity : Math.max(0, FREE_DAILY_UPLOADS - dailyUploads);

  const canUpload                = isPro || uploadsRemaining > 0;
  const canUseEffects            = isPro;
  const canUseAdvancedSubtitles  = isPro;
  const canGenerateShorts        = isPro;

  function isSubtitleAllowed(langCode) {
    if (isPro) return true;
    return BASIC_SUBTITLE_LANGS.includes(langCode);
  }

  return {
    plan,
    loaded,
    isPro,
    canUpload,
    canUseEffects,
    canUseAdvancedSubtitles,
    canGenerateShorts,
    uploadsRemaining,
    dailyUploads,
    isSubtitleAllowed,
    recordUpload,
    upgrade,
    downgrade,
    restore,
  };
}
