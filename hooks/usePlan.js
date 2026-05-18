/**
 * usePlan — Free/Pro plan yönetimi
 *
 * Supabase `users` tablosunu birincil kaynak olarak kullanır.
 * Supabase erişilemezse AsyncStorage fallback devreye girer.
 *
 * Kullanım:
 *   const { plan, canUpload, canUseEffects, ... } = usePlan(userId);
 *
 * Free limitleri:
 *   - Günde 2 video yükleme
 *   - Efektler yok
 *   - Sadece TR/EN altyazı
 *   - Shorts yok
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserPlan, upgradeToPro, incrementDailyUploads } from '../shared/supabase';

const FREE_DAILY_UPLOADS = 2;
const PRO_ADVANCED_SUBTITLE_LANGS = ['de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ar'];
const BASIC_SUBTITLE_LANGS = ['tr', 'en'];

const KEY_PLAN    = 'cliplav_plan';          // 'free' | 'pro'
const KEY_UPLOADS = 'cliplav_daily_uploads'; // { date: 'YYYY-MM-DD', count: N }

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function usePlan(userId) {
  const [plan, setPlan]             = useState('pro'); // geçici bypass
  const [dailyUploads, setDailyUploads] = useState(0);
  const [loaded, setLoaded]         = useState(false);

  // Plan ve upload sayacını yükle (Supabase öncelikli, fallback AsyncStorage)
  useEffect(() => {
    async function load() {
      try {
        if (userId) {
          // Supabase'den çek
          const data = await getUserPlan();
          if (data) {
            setPlan(data.plan ?? 'free');
            // Günlük upload sayacını kontrol et
            const today = todayStr();
            const count = data.daily_uploads_date === today
              ? (data.daily_uploads_count ?? 0)
              : 0;
            setDailyUploads(count);
            // AsyncStorage'ı da güncelle (offline fallback için)
            await Promise.all([
              AsyncStorage.setItem(KEY_PLAN, data.plan ?? 'free'),
              AsyncStorage.setItem(KEY_UPLOADS, JSON.stringify({ date: today, count })),
            ]);
            return;
          }
        }
        // Supabase kullanılamıyor veya user yok — AsyncStorage'dan yükle
        await loadFromStorage();
      } catch (e) {
        console.warn('[usePlan] load error:', e);
        await loadFromStorage();
      } finally {
        setLoaded(true);
      }
    }

    async function loadFromStorage() {
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
          setDailyUploads(0);
          await AsyncStorage.setItem(KEY_UPLOADS, JSON.stringify({ date: todayStr(), count: 0 }));
        }
      }
    }

    load();
    // Uygulama tekrar aktif olduğunda plan yenile (pro süresi dolmuş olabilir)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [userId]);

  const recordUpload = useCallback(async () => {
    const newCount = dailyUploads + 1;
    setDailyUploads(newCount);
    // AsyncStorage (hızlı)
    await AsyncStorage.setItem(KEY_UPLOADS, JSON.stringify({ date: todayStr(), count: newCount })).catch(() => {});
    // Supabase (arka planda)
    if (userId) incrementDailyUploads().catch(() => {});
  }, [dailyUploads, userId]);

  const upgrade = useCallback(async () => {
    setPlan('pro');
    await AsyncStorage.setItem(KEY_PLAN, 'pro').catch(() => {});
    if (userId) await upgradeToPro().catch(() => {});
  }, [userId]);

  const downgrade = useCallback(async () => {
    setPlan('free');
    await AsyncStorage.setItem(KEY_PLAN, 'free').catch(() => {});
  }, []);

  const restore = useCallback(async () => {
    if (userId) {
      const data = await getUserPlan().catch(() => null);
      if (data?.plan === 'pro') { setPlan('pro'); return; }
    }
    const storedPlan = await AsyncStorage.getItem(KEY_PLAN).catch(() => null);
    if (storedPlan === 'pro') setPlan('pro');
  }, [userId]);

  const isPro = true; // TODO: plan === 'pro' — şimdilik tüm özellikler açık
  const uploadsRemaining = isPro ? Infinity : Math.max(0, FREE_DAILY_UPLOADS - dailyUploads);

  const canUpload               = isPro || uploadsRemaining > 0;
  const canUseEffects           = isPro;
  const canUseAdvancedSubtitles = isPro;
  const canGenerateShorts       = isPro;

  function isSubtitleAllowed(langCode) {
    if (isPro) return true;
    return BASIC_SUBTITLE_LANGS.includes(langCode);
  }

  return {
    plan, loaded, isPro,
    canUpload, canUseEffects, canUseAdvancedSubtitles, canGenerateShorts,
    uploadsRemaining, dailyUploads, isSubtitleAllowed,
    recordUpload, upgrade, downgrade, restore,
  };
}
