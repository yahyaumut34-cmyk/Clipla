import { Platform } from 'react-native';
import Constants from 'expo-constants';

const BASE_WEB = 'http://127.0.0.1:8000';
const DEFAULT_MOBILE = 'http://192.168.1.6:8000';
const ANDROID_EMULATOR = 'http://10.0.2.2:8000';
const IOS_SIMULATOR = 'http://127.0.0.1:8000';

const configBackendUrl =
  Constants?.expoConfig?.extra?.backendUrl ||
  Constants?.manifest?.extra?.backendUrl ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.REACT_NATIVE_BACKEND_URL ||
  process.env.BACKEND_URL;

const DEFAULT_NATIVE = Platform.OS === 'android'
  ? (Constants.isDevice === false ? ANDROID_EMULATOR : DEFAULT_MOBILE)
  : (Constants.isDevice === false ? IOS_SIMULATOR : DEFAULT_MOBILE);

export const BASE_URL = Platform.OS === 'web'
  ? BASE_WEB
  : configBackendUrl || DEFAULT_NATIVE;
export const WARN_BYTES = 300 * 1024 * 1024;
const MAX_BYTES = 800 * 1024 * 1024;

// API key — Expo config veya env'den okunur
// Production'da EXPO_PUBLIC_API_KEY ortam değişkenini ayarlayın
const API_KEY =
  Constants?.expoConfig?.extra?.apiKey ||
  process.env.EXPO_PUBLIC_API_KEY ||
  '1p8LO_BwlNTZW_o1ZVvXRWBu_gv_HON0O6yVDekJIK4';

/** Tüm API isteklerine eklenen ortak header'lar */
function authHeaders(extra = {}) {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    ...extra,
  };
}

export async function uploadVideo(asset) {
  const fd = new FormData();

  const isWebFile = (typeof File !== 'undefined' && asset instanceof File) ||
                    (typeof Blob !== 'undefined' && asset instanceof Blob);

  if (isWebFile) {
    if (__DEV__) console.log('[upload] web | name:', asset.name, '| size:', (asset.size/1024/1024).toFixed(1), 'MB');
    fd.append('file', asset, asset.name || 'video.mp4');
  } else {
    const uri      = asset.uri;
    const filename = asset.fileName || uri?.split('/').pop() || 'video.mp4';
    const ext      = filename.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeType = asset.mimeType || `video/${ext}`;
    const fileSize = asset.fileSize || 0;

    if (__DEV__) console.log('[upload] native | file:', filename, '| size:', (fileSize/1024/1024).toFixed(1), 'MB');

    if (fileSize > MAX_BYTES) {
      throw new Error(`Video çok büyük (${(fileSize/1024/1024).toFixed(0)} MB). Maksimum 800 MB yükleyebilirsiniz.`);
    }

    fd.append('file', { uri, name: filename, type: mimeType });
  }

  const res = await fetch(`${BASE_URL}/api/video/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  if (__DEV__) console.log('[upload] status:', res.status);
  const text = await res.text();
  if (__DEV__) console.log('[upload] response:', text.slice(0, 200));

  let data;
  try {
    data = JSON.parse(text);
  } catch(e) {
    throw new Error('Sunucu geçersiz yanıt verdi. Lütfen tekrar deneyin.');
  }

  if (!res.ok) throw new Error(data.detail || 'Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  if (!data.job_id) throw new Error('Sunucudan geçersiz yanıt alındı. Lütfen tekrar deneyin.');
  return data;
}

export async function sendChatMessage({ message, history = [], jobId, language = 'tr-TR' }) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, history, job_id: jobId, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI asistana ulaşılamadı. Lütfen tekrar deneyin.');
  return data;
}

export async function autoEdit(jobId, {
  commandText       = '',
  platform          = 'youtube',
  targetDurationSec = null,
  removeFillers     = false,
  preserveRhythm    = true,
} = {}) {
  const res = await fetch(`${BASE_URL}/api/auto-edit/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      command_text:        commandText,
      platform,
      target_duration_sec: targetDurationSec,
      remove_fillers:      removeFillers,
      preserve_rhythm:     preserveRhythm,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Video düzenlenemedi. Lütfen tekrar deneyin.');
  return data;
}

/**
 * Upload with progress callback: onProgress(percent: 0-100)
 * Web: XMLHttpRequest ile gerçek ilerleme
 * Native: expo-file-system uploadAsync ile ilerleme
 */
export async function uploadVideoWithProgress(asset, onProgress) {
  const isWebFile = (typeof File !== 'undefined' && asset instanceof File) ||
                    (typeof Blob !== 'undefined' && asset instanceof Blob);

  if (isWebFile) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', asset, asset.name || 'video.mp4');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/video/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${API_KEY}`);

      // Gerçek progress — lengthComputable varsa
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };

      // Upload tamamlandı (sunucu yanıtı bekleniyor) → %95 göster
      xhr.upload.onload = () => onProgress?.(95);

      xhr.onload = () => {
        onProgress?.(100);
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) { reject(new Error(data.detail || `Upload failed: ${xhr.status}`)); return; }
          if (!data.job_id) { reject(new Error('job_id alınamadı')); return; }
          resolve(data);
        } catch { reject(new Error('Sunucu geçersiz yanıt verdi')); }
      };
      xhr.onerror   = () => reject(new Error('Sunucuya bağlanılamadı. Backend çalışıyor mu?'));
      xhr.ontimeout = () => reject(new Error('Bağlantı zaman aşımı'));
      xhr.timeout   = 5 * 60 * 1000; // 5 dakika
      xhr.send(fd);
    });
  }

  // Native: expo-file-system
  const { FileSystem } = await import('expo-file-system');
  const uri      = asset.uri;
  const filename = asset.fileName || uri?.split('/').pop() || 'video.mp4';
  const ext      = filename.split('.').pop()?.toLowerCase() || 'mp4';
  const mimeType = asset.mimeType || `video/${ext}`;

  const uploadTask = FileSystem.createUploadTask(
    `${BASE_URL}/api/video/upload`,
    uri,
    {
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters: {},
      headers: { Authorization: `Bearer ${API_KEY}` },
    },
    (progress) => {
      const pct = progress.totalBytesExpectedToSend > 0
        ? Math.round((progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100)
        : 0;
      onProgress?.(pct);
    }
  );

  const result = await uploadTask.uploadAsync();
  let data;
  try { data = JSON.parse(result.body); } catch { throw new Error('Sunucu geçersiz yanıt verdi. Lütfen tekrar deneyin.'); }
  if (result.status >= 400) throw new Error(data.detail || 'Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  if (!data.job_id) throw new Error('Sunucudan geçersiz yanıt alındı. Lütfen tekrar deneyin.');
  return data;
}

export async function generateShorts(jobId, {
  topN               = 5,
  reencode           = false,
  semanticAnalysis   = true,
  requireCompleteness = true,
  detectEmotionalPeak = true,
} = {}, plan = 'free') {
  const res = await fetch(`${BASE_URL}/api/shorts/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-User-Plan': plan }),
    body: JSON.stringify({
      top_n:                topN,
      reencode,
      semantic_analysis:    semanticAnalysis,
      require_completeness: requireCompleteness,
      detect_emotional_peak: detectEmotionalPeak,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Kısa klipler oluşturulamadı. Lütfen tekrar deneyin.');
  return data;
}

export function toAbsoluteUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

export function bustCache(url) {
  if (!url) return '';
  return `${url}?t=${Date.now()}`;
}

export async function getAutoEditStatus(jobId) {
  const res = await fetch(`${BASE_URL}/api/auto-edit/${jobId}/status`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'İşlem durumu alınamadı. Lütfen bekleyin.');
  return data;
}

export async function generateSubtitles(jobId, { language = 'tr', burn_in = true, font_size = 16, position = 'bottom' } = {}) {
  const res = await fetch(`${BASE_URL}/api/subtitles/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ language, burn_in, font_size, position }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Altyazı oluşturulamadı. Lütfen tekrar deneyin.');
  return data;
}

export async function applyEffect(jobId, { category, intensity = 0.8, timestamp = null } = {}, plan = 'free') {
  const res = await fetch(`${BASE_URL}/api/effects/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', 'X-User-Plan': plan }),
    body: JSON.stringify({ category, intensity, timestamp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Efekt uygulanamadı. Lütfen tekrar deneyin.');
  return data;
}

export async function transcribeAudio(audioBlob, filename = 'command.webm', language = 'tr') {
  const fd = new FormData();
  fd.append('file', audioBlob, filename);
  fd.append('language', language.split('-')[0]); // 'tr-TR' → 'tr'
  const res = await fetch(`${BASE_URL}/api/stt/transcribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Ses tanıma başarısız. Lütfen tekrar deneyin.');
  return data;
}

export async function addSoundEffect(jobId, { sfx_type, timestamp = null, volume = 0.85 } = {}) {
  const res = await fetch(`${BASE_URL}/api/sfx/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sfx_type, timestamp, volume }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Ses efekti uygulanamadı. Lütfen tekrar deneyin.');
  return data;
}

export async function addMusic(jobId, { mood, start_time = 0, end_time = null, volume = 0.22 } = {}) {
  const res = await fetch(`${BASE_URL}/api/music/${jobId}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ mood, start_time, end_time, volume }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Müzik eklenemedi. Lütfen tekrar deneyin.');
  return data;
}