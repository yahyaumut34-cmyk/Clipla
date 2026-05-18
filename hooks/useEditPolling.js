/**
 * useEditPolling — auto-edit başlatır, /api/auto-edit/:jobId/status'u polling yapar
 *
 * Arayüz:
 *   const { editLoading, editProgress, startEdit } = useEditPolling({ jobId, onDone, onError });
 *
 *   startEdit({ commandText, platform, targetDurationSec, subtitleLang })
 *   editProgress: string — "Ses analiz ediliyor... %40" gibi
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { autoEdit, getAutoEditStatus, generateSubtitles, toAbsoluteUrl } from '../api';
import { useTTS } from './useTTS';

const POLL_INTERVAL_MS  = 4000;          // temel polling aralığı
const POLL_JITTER_MS    = 800;           // thundering herd'ü önlemek için rastgele ±jitter
const TIMEOUT_MS        = 5 * 60 * 1000; // 5 dakika
const SUBTITLE_TIMEOUT  = 60 * 1000;     // altyazı için 60s ayrı timeout

const STATUS_LABELS = {
  pending:    'Sıraya alındı...',
  queued:     'Sıraya alındı...',
  processing: 'İşleniyor...',
  analyzing:  'Ses analiz ediliyor...',
  cutting:    'Kesimler uygulanıyor...',
  rendering:  'Video render ediliyor...',
  done:       'Tamamlandı!',
  completed:  'Tamamlandı!',
  error:      'Hata oluştu',
  failed:     'Hata oluştu',
};

export function useEditPolling({ jobId, onDone, onError }) {
  const [editLoading, setEditLoading]   = useState(false);
  const [editProgress, setEditProgress] = useState('');

  const pollRef      = useRef(null);
  const startedAt    = useRef(null);
  const pollActiveRef = useRef(false); // overlap koruması
  const lastSpokenRef = useRef({ status: '', progress: 0 });

  const { speak } = useTTS();

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollActiveRef.current = false;
  }

  function formatProgress(statusData) {
    const label = STATUS_LABELS[statusData?.status] || 'İşleniyor...';
    const pct   = statusData?.progress != null ? ` %${Math.round(statusData.progress)}` : '';
    const step  = statusData?.step ? ` — ${statusData.step}` : '';
    return label + pct + step;
  }

  const startEdit = useCallback(async ({
    commandText       = '',
    platform          = 'youtube',
    targetDurationSec = null,
    subtitleLang      = null,
    removeFillers     = false,
    preserveRhythm    = true,
  } = {}) => {
    stopPolling(); // önceki interval varsa temizle (çift çağrı koruması)
    setEditLoading(true);
    setEditProgress('Başlatılıyor...');
    lastSpokenRef.current = { status: '', progress: 0 };
    speak('Düzenleme başladı');
    startedAt.current = Date.now();

    try {
      // Edit isteğini gönder
      const initialData = await autoEdit(jobId, { commandText, platform, targetDurationSec, removeFillers, preserveRhythm });

      // Backend senkron yanıt verdiyse (küçük videolar) doğrudan tamamla
      if (initialData?.status === 'done' || initialData?.status === 'completed' || initialData?.download_url || initialData?.output_url) {
        await applySubtitleAndFinish(initialData, subtitleLang);
        return;
      }

      // Async: polling başlat
      setEditProgress(formatProgress(initialData));

      const jitter = Math.round((Math.random() - 0.5) * POLL_JITTER_MS);
      pollRef.current = setInterval(async () => {
        // Timeout kontrolü
        if (Date.now() - startedAt.current > TIMEOUT_MS) {
          stopPolling();
          setEditLoading(false);
          setEditProgress('');
          onError?.(new Error('İşlem zaman aşımına uğradı (5 dakika)'));
          return;
        }

        if (pollActiveRef.current) return; // overlap: önceki istek bitmedi
        pollActiveRef.current = true;
        try {
          const statusData = await getAutoEditStatus(jobId);
          setEditProgress(formatProgress(statusData));

          // Voice feedback
          const currentStatus = statusData?.status || '';
          const currentProgress = statusData?.progress || 0;
          if (currentStatus !== lastSpokenRef.current.status) {
            const label = STATUS_LABELS[currentStatus] || 'İşleniyor...';
            speak(label.replace(/%/g, 'yüzde'));
            lastSpokenRef.current.status = currentStatus;
          }
          if (currentProgress >= 25 && lastSpokenRef.current.progress < 25) {
            speak('Yüzde 25 tamamlandı');
            lastSpokenRef.current.progress = 25;
          } else if (currentProgress >= 50 && lastSpokenRef.current.progress < 50) {
            speak('Yüzde 50 tamamlandı');
            lastSpokenRef.current.progress = 50;
          } else if (currentProgress >= 75 && lastSpokenRef.current.progress < 75) {
            speak('Yüzde 75 tamamlandı');
            lastSpokenRef.current.progress = 75;
          }

          if (statusData.status === 'done' || statusData.status === 'completed' || statusData.download_url || statusData.output_url) {
            stopPolling();
            await applySubtitleAndFinish(statusData, subtitleLang);
          } else if (statusData.status === 'error' || statusData.status === 'failed') {
            stopPolling();
            setEditLoading(false);
            setEditProgress('');
            onError?.(new Error(statusData.error || statusData.detail || 'İşlem başarısız'));
          }
        } catch(pollErr) {
          console.warn('[useEditPolling] poll error:', pollErr);
        } finally {
          pollActiveRef.current = false;
        }
      }, POLL_INTERVAL_MS + jitter);

    } catch(e) {
      stopPolling();
      setEditLoading(false);
      setEditProgress('');
      onError?.(e);
    }
  }, [jobId, onDone, onError]);

  async function applySubtitleAndFinish(data, subtitleLang) {
    let finalResult = { ...data, suggestedSubtitleLang: subtitleLang };

    if (subtitleLang) {
      try {
        const subData = await Promise.race([
          generateSubtitles(jobId, { language: subtitleLang }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Altyazı zaman aşımı')), SUBTITLE_TIMEOUT)
          ),
        ]);
        if (subData?.video_url) {
          const absUrl = toAbsoluteUrl(subData.video_url);
          finalResult = {
            ...finalResult,
            download_url:         absUrl,
            output_url:           absUrl,
            autoSubtitleApplied:  true,
            autoSubtitleLanguage: subtitleLang,
          };
        }
      } catch(subErr) {
        console.warn('[useEditPolling] subtitle error:', subErr.message);
      }
    }

    setEditLoading(false);
    setEditProgress('');
    speak('Düzenleme tamamlandı');
    onDone?.(finalResult);
  }

  return { editLoading, editProgress, startEdit };
}
