/**
 * Supabase istemcisi — React Native / Expo
 *
 * Kullanım:
 *   import { supabase } from '../shared/supabase';
 *   const { data, error } = await supabase.from('jobs').select('*');
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IS_WEB } from './theme';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const _isValidUrl = (url) => {
  try { new URL(url); return url.startsWith('https://'); }
  catch { return false; }
};

export const DEV_MODE = !_isValidUrl(SUPABASE_URL) || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('GİR');

let supabaseClient;
if (DEV_MODE) {
  console.warn('[supabase] Dev modu: Supabase credentials eksik, sahte istemci kullanılıyor.');
  const _noop = async () => ({ data: null, error: null });
  const _noopSub = { unsubscribe: () => {} };
  supabaseClient = {
    from: () => ({
      select: () => ({ eq: () => ({ single: _noop, order: _noop }), order: _noop, then: (f) => f({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: _noop }), then: (f) => f({ data: null, error: null }) }),
      update: () => ({ eq: _noop }),
      upsert: () => ({ then: (f) => f({ data: null, error: null }) }),
    }),
    rpc: _noop,
    auth: {
      getSession:            async () => ({ data: { session: null }, error: null }),
      getUser:               async () => ({ data: { user: null }, error: null }),
      signUp:                async () => ({ data: { user: null }, error: null }),
      signInWithPassword:    async () => ({ data: { session: null }, error: null }),
      signInWithOAuth:       async () => ({ data: null, error: null }),
      signOut:               async () => ({ error: null }),
      setSession:            async () => ({ data: null, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      onAuthStateChange:     (cb) => { return { data: { subscription: _noopSub } }; },
    },
  };
} else {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: IS_WEB,
    },
  });
}

export const supabase = supabaseClient;

// ── AUTH ─────────────────────────────────────────────────────────────────────

/** Email + şifre ile yeni hesap oluşturur */
export async function signUp(email, password) {
  const result = await supabase.auth.signUp({ email, password });
  if (result.data?.user && !result.error) {
    // users tablosuna kayıt ekle (plan başlangıcı)
    await supabase.from('users').upsert({
      id:                   result.data.user.id,
      email,
      plan:                 'free',
      daily_uploads_count:  0,
      daily_uploads_date:   new Date().toISOString().slice(0, 10),
    }, { onConflict: 'id', ignoreDuplicates: true }).then(({ error }) => {
      if (error) console.warn('[supabase] signUp users insert:', error.message);
    });
  }
  return result;
}

/** Email + şifre ile giriş yapar */
export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Oturumu kapatır */
export function signOut() {
  return supabase.auth.signOut();
}

/** Mevcut oturumu döner */
export function getSession() {
  return supabase.auth.getSession();
}

/** Auth durumu değişince cb'yi çağırır */
export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange(cb);
}

/** GitHub OAuth ile giriş — Web'de yeni sekme, Native'de in-app browser */
export async function signInWithGitHub() {
  if (IS_WEB) {
    return supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
  }
  // Native: expo-web-browser ile OAuth
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: 'com.cliplav.app://auth/callback',
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) return { error };

  const { openAuthSessionAsync } = await import('expo-web-browser');
  const result = await openAuthSessionAsync(data.url, 'com.cliplav.app://auth/callback');

  if (result.type === 'success' && result.url) {
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.slice(1));
    const access_token  = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token) {
      return supabase.auth.setSession({ access_token, refresh_token });
    }
  }
  return { error: new Error('GitHub girişi iptal edildi') };
}

/** Şifre sıfırlama emaili gönderir */
export function resetPassword(email) {
  const redirectTo = IS_WEB
    ? `${window.location.origin}/reset-password`
    : 'com.cliplav.app://reset-password';
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/** Mevcut oturumdaki kullanıcı ID'sini döner */
export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── JOBS ─────────────────────────────────────────────────────────────────────

/**
 * Yeni bir job kaydı oluşturur (video yüklendikten sonra)
 * @param {string} jobId - Backend'den gelen UUID
 * @param {string} filename
 * @param {number} duration - saniye
 * @param {object} info - { codec, width, height, fps, resolution }
 */
export async function createJob(jobId, filename, duration, info = {}) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      id:         jobId,
      user_id:    userId,
      filename,
      duration,
      codec:      info.codec      ?? null,
      width:      info.width      ?? null,
      height:     info.height     ?? null,
      fps:        info.fps        ?? null,
      resolution: info.resolution ?? null,
      status:     'uploaded',
    })
    .select()
    .single();

  if (error) console.error('[supabase] createJob:', error.message);
  return { data, error };
}

/** Job durumunu günceller */
export async function updateJobStatus(jobId, status) {
  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', jobId);
  if (error) console.error('[supabase] updateJobStatus:', error.message);
}

// ── CHAT MESSAGES ─────────────────────────────────────────────────────────────

/**
 * Sohbet mesajı kaydeder
 * @param {string} jobId
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {string} language
 */
export async function saveChatMessage(jobId, role, content, language = 'tr-TR') {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ job_id: jobId, role, content, language });
  if (error) console.error('[supabase] saveChatMessage:', error.message);
}

/** Job'ın tüm sohbet geçmişini getirir */
export async function getChatHistory(jobId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) console.error('[supabase] getChatHistory:', error.message);
  return data ?? [];
}

// ── EDIT CONFIRMATIONS ────────────────────────────────────────────────────────

/** AI onay planını kaydeder */
export async function saveEditConfirmation(jobId, confirmData) {
  const { data, error } = await supabase
    .from('edit_confirmations')
    .insert({
      job_id:              jobId,
      command_text:        confirmData.command_text,
      platform:            confirmData.platform ?? 'youtube',
      target_duration_sec: confirmData.target_duration_sec ?? null,
      remove_fillers:      confirmData.removeFillers ?? true,
      preserve_rhythm:     confirmData.preserveRhythm ?? true,
      subtitle_language:   confirmData.subtitle_language ?? null,
      status:              'pending',
    })
    .select()
    .single();
  if (error) console.error('[supabase] saveEditConfirmation:', error.message);
  return data;
}

/** Onay durumunu günceller (confirmed / rejected) */
export async function updateConfirmationStatus(confirmationId, status) {
  const { error } = await supabase
    .from('edit_confirmations')
    .update({
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
    })
    .eq('id', confirmationId);
  if (error) console.error('[supabase] updateConfirmationStatus:', error.message);
}

// ── EDIT JOBS ────────────────────────────────────────────────────────────────

/** Edit işi başlayınca kaydeder */
export async function createEditJob(jobId, params, confirmationId = null) {
  const { data, error } = await supabase
    .from('edit_jobs')
    .insert({
      job_id:              jobId,
      confirmation_id:     confirmationId,
      command_text:        params.commandText ?? '',
      platform:            params.platform ?? 'youtube',
      target_duration_sec: params.targetDurationSec ?? null,
      remove_fillers:      params.removeFillers ?? true,
      preserve_rhythm:     params.preserveRhythm ?? true,
      status:              'pending',
    })
    .select()
    .single();
  if (error) console.error('[supabase] createEditJob:', error.message);
  return data;
}

/** Polling sırasında edit job durumunu günceller */
export async function updateEditJobStatus(editJobId, statusData) {
  const { error } = await supabase
    .from('edit_jobs')
    .update({
      status:       statusData.status,
      progress:     statusData.progress ?? null,
      step:         statusData.step ?? null,
      error_message: statusData.error ?? null,
      completed_at: ['done', 'completed', 'error', 'failed'].includes(statusData.status)
        ? new Date().toISOString()
        : null,
    })
    .eq('id', editJobId);
  if (error) console.error('[supabase] updateEditJobStatus:', error.message);
}

// ── EDIT RESULTS (video_outputs, scores, analysis_results, edit_plans) ────────

/** Auto-edit tamamlandığında tüm sonuçları kaydeder */
export async function saveEditResults(jobId, editJobId, result) {
  const ops = [];

  // video_outputs
  if (result.download_url || result.output_url) {
    ops.push(
      supabase.from('video_outputs').insert({
        job_id:         jobId,
        edit_job_id:    editJobId,
        output_url:     result.output_url  ?? result.download_url,
        download_url:   result.download_url ?? result.output_url,
        duration:       result.duration?.output ?? null,
        input_duration: result.duration?.input  ?? null,
      })
    );
  }

  // scores
  if (result.scores && Object.keys(result.scores).length > 0) {
    ops.push(
      supabase.from('scores').insert({
        job_id:          jobId,
        edit_job_id:     editJobId,
        info_density:    result.scores.info_density    ?? null,
        pacing_score:    result.scores.pacing_score    ?? null,
        hook_score:      result.scores.hook_score      ?? null,
        retention_score: result.scores.retention_score ?? null,
        silence_risk:    result.scores.silence_risk    ?? null,
        kept_sec:        result.scores.kept_sec        ?? null,
        cuts_per_min:    result.scores.cuts_per_min    ?? null,
        word_count:      result.scores.word_count      ?? null,
      })
    );
  }

  // analysis_results (claude_analysis)
  const ca = result.claude_analysis;
  if (ca && Object.keys(ca).length > 0) {
    ops.push(
      supabase.from('analysis_results').insert({
        job_id:           jobId,
        edit_job_id:      editJobId,
        hook_quality:     ca.hook_quality     ?? null,
        hook_suggestion:  ca.hook_suggestion  ?? null,
        best_moment:      ca.best_moment      ?? null,
        cut_suggestion:   ca.cut_suggestion   ?? null,
        platform_fit:     ca.platform_fit     ?? null,
        viral_score:      ca.viral_score      ?? null,
        one_line_summary: ca.one_line_summary ?? null,
        suggestions:      ca.suggestions      ?? [],
        raw_response:     ca,
      })
    );
  }

  // edit_plans
  const ep = result.edit_plan;
  if (ep) {
    ops.push(
      supabase.from('edit_plans').insert({
        job_id:       jobId,
        edit_job_id:  editJobId,
        cuts_applied: ep.cuts_applied ?? 0,
        keeps_used:   ep.keeps_used   ?? 0,
        intro_sec:    ep.intro_sec    ?? null,
        outro_sec:    ep.outro_sec    ?? null,
        keeps:        ep.keeps        ?? [],
      })
    );
  }

  const results = await Promise.allSettled(ops);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[supabase] saveEditResults op[${i}]:`, r.reason);
    }
  });
}

// ── SUBTITLES ────────────────────────────────────────────────────────────────

export async function saveSubtitle(jobId, params) {
  const { data, error } = await supabase
    .from('subtitles')
    .insert({
      job_id:       jobId,
      language:     params.language ?? 'tr',
      video_url:    params.video_url ?? null,
      burn_in:      params.burn_in ?? true,
      font_size:    params.font_size ?? 16,
      position:     params.position ?? 'bottom',
      status:       'completed',
      auto_applied: params.auto_applied ?? false,
      applied_at:   new Date().toISOString(),
    })
    .select()
    .single();
  if (error) console.error('[supabase] saveSubtitle:', error.message);
  return data;
}

// ── EFFECTS ──────────────────────────────────────────────────────────────────

export async function saveEffect(jobId, effectData) {
  const { data, error } = await supabase
    .from('effects')
    .insert({
      job_id:     jobId,
      category:   effectData.category,
      intensity:  effectData.intensity ?? 0.8,
      timestamp:  effectData.timestamp ?? null,
      label:      effectData.label     ?? null,
      emoji:      effectData.emoji     ?? null,
      video_url:  effectData.video_url ?? null,
      status:     'completed',
      applied_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) console.error('[supabase] saveEffect:', error.message);
  return data;
}

// ── SHORTS ───────────────────────────────────────────────────────────────────

export async function saveShorts(jobId, shortsList) {
  if (!shortsList || shortsList.length === 0) return;
  const rows = shortsList.map((s, i) => ({
    job_id:               jobId,
    index:                s.index ?? (i + 1),
    start_sec:            s.start,
    end_sec:              s.end,
    duration:             s.end - s.start,
    semantic_score:       s.semantic_score     ?? null,
    completeness:         s.completeness       ?? null,
    overall_score:        s.score              ?? null,
    emotional_peak:       s.emotional_peak     ?? false,
    narrative_structure:  s.narrative_structure ?? null,
    why_good:             s.why_good           ?? null,
    text_preview:         s.text_preview       ?? null,
    url:                  s.url                ?? null,
    status:               s.status             ?? 'completed',
    error:                s.error              ?? null,
  }));
  const { error } = await supabase.from('shorts').insert(rows);
  if (error) console.error('[supabase] saveShorts:', error.message);
}

// ── PLAN ─────────────────────────────────────────────────────────────────────

/** Plan bilgisini DB'den çeker (AsyncStorage yerine) */
export async function getUserPlan() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('plan, daily_uploads_count, daily_uploads_date, upgraded_at')
    .eq('id', userId)
    .single();
  if (error) console.error('[supabase] getUserPlan:', error.message);
  return data;
}

/** Günlük upload sayacını artırır */
export async function incrementDailyUploads() {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.rpc('increment_daily_uploads', { uid: userId });
  if (error) {
    // RPC yoksa manuel güncelle
    const { data: user } = await supabase.from('users').select('daily_uploads_count, daily_uploads_date').eq('id', userId).single();
    const today = new Date().toISOString().slice(0, 10);
    const count = user?.daily_uploads_date === today ? (user.daily_uploads_count + 1) : 1;
    await supabase.from('users').update({ daily_uploads_count: count, daily_uploads_date: today }).eq('id', userId);
  }
}

/** Pro'ya yükselt */
export async function upgradeToPro() {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('users')
    .update({ plan: 'pro', upgraded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.error('[supabase] upgradeToPro:', error.message);
}

// ── ANALYTICS ────────────────────────────────────────────────────────────────

export async function logEvent(event, jobId = null, extra = {}) {
  const userId = await getCurrentUserId();
  // Hata olsa bile uygulamayı bloke etme
  supabase.from('analytics').insert({
    event,
    job_id:  jobId,
    user_id: userId,
    extra,
  }).then(({ error }) => {
    if (error) console.warn('[supabase] logEvent:', error.message);
  });
}
