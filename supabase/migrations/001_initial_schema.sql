-- ============================================================
-- Clipla-Y — Supabase DDL Şeması
-- Migration: 001_initial_schema
-- ============================================================

-- Uzantılar
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM'lar ─────────────────────────────────────────────────

CREATE TYPE plan_type AS ENUM ('free', 'pro');

CREATE TYPE job_status AS ENUM (
  'uploaded', 'processing', 'completed', 'failed'
);

CREATE TYPE edit_status AS ENUM (
  'pending', 'queued', 'processing', 'analyzing',
  'cutting', 'rendering', 'done', 'error', 'failed'
);

CREATE TYPE message_role AS ENUM ('user', 'assistant');

CREATE TYPE confirmation_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TYPE subtitle_position AS ENUM ('top', 'bottom');

CREATE TYPE subtitle_status AS ENUM ('pending', 'generating', 'completed', 'failed');

CREATE TYPE effect_category AS ENUM (
  'impact_shock', 'comedy_reaction', 'tension_build',
  'crowd_laugh', 'impact_emphasis', 'fail_tone', 'epic_moment'
);

CREATE TYPE effect_status AS ENUM ('pending', 'applying', 'completed', 'failed');

CREATE TYPE short_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TYPE platform_type AS ENUM ('youtube', 'youtube_shorts', 'tiktok', 'instagram');

CREATE TYPE subtitle_lang AS ENUM (
  'tr', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ar'
);

CREATE TYPE narrative_structure AS ENUM (
  'introduction', 'development', 'climax', 'resolution'
);

-- ── YARDIMCI FONKSİYON: updated_at otomatik güncelle ─────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. USERS
--    Supabase Auth ile entegre (auth.users'a FK)
-- ============================================================

CREATE TABLE public.users (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  plan_type   NOT NULL DEFAULT 'free',
  daily_uploads_count   INTEGER     NOT NULL DEFAULT 0,
  daily_uploads_date    DATE                 DEFAULT CURRENT_DATE,
  upgraded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Yeni auth kullanıcısı oluşunca otomatik users satırı ekle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Günlük upload sıfırlama
CREATE OR REPLACE FUNCTION reset_daily_uploads_if_needed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.daily_uploads_date < CURRENT_DATE THEN
    NEW.daily_uploads_count = 0;
    NEW.daily_uploads_date  = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reset_daily_uploads
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION reset_daily_uploads_if_needed();

-- ============================================================
-- 2. JOBS
--    Her video yüklemesi bir job oluşturur
-- ============================================================

CREATE TABLE public.jobs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  -- Dosya bilgisi
  filename    TEXT          NOT NULL,
  file_path   TEXT,
  size_bytes  BIGINT,
  -- Video metadata (ffprobe)
  duration    NUMERIC(10,2),
  codec       TEXT,
  width       INTEGER,
  height      INTEGER,
  fps         TEXT,
  resolution  TEXT,
  -- Durum
  status      job_status    NOT NULL DEFAULT 'uploaded',
  -- Sohbetten tespit edilen
  platform    platform_type          DEFAULT 'youtube',
  language    TEXT                   DEFAULT 'tr-TR',
  -- Audit
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_status  ON public.jobs(status);
CREATE INDEX idx_jobs_created ON public.jobs(created_at DESC);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. CHAT_MESSAGES
-- ============================================================

CREATE TABLE public.chat_messages (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID          NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  role        message_role  NOT NULL,
  content     TEXT          NOT NULL,
  language    TEXT                   DEFAULT 'tr-TR',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_job_id ON public.chat_messages(job_id, created_at);

-- ============================================================
-- 4. EDIT_CONFIRMATIONS
--    AI "ready_to_edit" dediğinde oluşan onay kartı
-- ============================================================

CREATE TABLE public.edit_confirmations (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID                  NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  command_text        TEXT                  NOT NULL,
  platform            platform_type         NOT NULL DEFAULT 'youtube',
  target_duration_sec INTEGER,
  remove_fillers      BOOLEAN               NOT NULL DEFAULT TRUE,
  preserve_rhythm     BOOLEAN               NOT NULL DEFAULT TRUE,
  subtitle_language   subtitle_lang,
  status              confirmation_status   NOT NULL DEFAULT 'pending',
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_edit_confirmations_job_id ON public.edit_confirmations(job_id);

CREATE TRIGGER trg_edit_confirmations_updated_at
  BEFORE UPDATE ON public.edit_confirmations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. EDIT_JOBS
--    /api/auto-edit tetiklenen iş + polling durumu
-- ============================================================

CREATE TABLE public.edit_jobs (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID          NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  confirmation_id     UUID          REFERENCES public.edit_confirmations(id) ON DELETE SET NULL,
  command_text        TEXT          NOT NULL,
  platform            platform_type NOT NULL DEFAULT 'youtube',
  target_duration_sec INTEGER,
  remove_fillers      BOOLEAN       NOT NULL DEFAULT TRUE,
  preserve_rhythm     BOOLEAN       NOT NULL DEFAULT TRUE,
  status              edit_status   NOT NULL DEFAULT 'pending',
  progress            NUMERIC(5,2)           DEFAULT 0,
  step                TEXT,
  started_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_edit_jobs_job_id ON public.edit_jobs(job_id);
CREATE INDEX idx_edit_jobs_status ON public.edit_jobs(status);

CREATE TRIGGER trg_edit_jobs_updated_at
  BEFORE UPDATE ON public.edit_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. TRANSCRIPTS
--    Whisper çıktısı
-- ============================================================

CREATE TABLE public.transcripts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  model       TEXT                   DEFAULT 'base',
  language    TEXT,
  full_text   TEXT        NOT NULL,
  segments    JSONB       NOT NULL DEFAULT '[]',
  word_count  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- segments: [{"start": 0.0, "end": 3.2, "text": "Merhaba..."}, ...]
CREATE INDEX idx_transcripts_job_id ON public.transcripts(job_id);

-- ============================================================
-- 7. ANALYSIS_RESULTS
--    Claude analizi (claude_analysis)
-- ============================================================

CREATE TABLE public.analysis_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  edit_job_id       UUID        REFERENCES public.edit_jobs(id) ON DELETE SET NULL,
  hook_quality      TEXT,
  hook_suggestion   TEXT,
  best_moment       TEXT,
  cut_suggestion    TEXT,
  platform_fit      TEXT,
  viral_score       INTEGER,
  one_line_summary  TEXT,
  suggestions       JSONB       NOT NULL DEFAULT '[]',
  raw_response      JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_job_id ON public.analysis_results(job_id);

-- ============================================================
-- 8. EDIT_PLANS
--    Kesim planı detayları
-- ============================================================

CREATE TABLE public.edit_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  edit_job_id   UUID        REFERENCES public.edit_jobs(id) ON DELETE SET NULL,
  cuts_applied  INTEGER              DEFAULT 0,
  keeps_used    INTEGER              DEFAULT 0,
  intro_sec     NUMERIC(8,3),
  outro_sec     NUMERIC(8,3),
  keeps         JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- keeps: [{"from": 0.0, "to": 12.5}, ...]
CREATE INDEX idx_edit_plans_job_id ON public.edit_plans(job_id);

-- ============================================================
-- 9. SCORES
--    Kalite metrikleri
-- ============================================================

CREATE TABLE public.scores (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  edit_job_id     UUID        REFERENCES public.edit_jobs(id) ON DELETE SET NULL,
  info_density    NUMERIC(6,2),
  pacing_score    NUMERIC(6,2),
  hook_score      NUMERIC(6,2),
  retention_score NUMERIC(6,2),
  silence_risk    NUMERIC(6,2),
  kept_sec        NUMERIC(10,3),
  cuts_per_min    NUMERIC(8,2),
  word_count      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_job_id ON public.scores(job_id);

-- ============================================================
-- 10. VIDEO_OUTPUTS
--     Üretilen video dosyaları
-- ============================================================

CREATE TABLE public.video_outputs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  edit_job_id     UUID        REFERENCES public.edit_jobs(id) ON DELETE SET NULL,
  output_url      TEXT        NOT NULL,
  download_url    TEXT,
  size_bytes      BIGINT,
  duration        NUMERIC(10,2),
  input_duration  NUMERIC(10,2),
  codec           TEXT,
  width           INTEGER,
  height          INTEGER,
  fps             TEXT,
  resolution      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_video_outputs_job_id ON public.video_outputs(job_id);

-- ============================================================
-- 11. SUBTITLES
-- ============================================================

CREATE TABLE public.subtitles (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID              NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  language            subtitle_lang     NOT NULL DEFAULT 'tr',
  video_url           TEXT,
  subtitle_file_path  TEXT,
  burn_in             BOOLEAN           NOT NULL DEFAULT TRUE,
  font_size           INTEGER           NOT NULL DEFAULT 16,
  position            subtitle_position NOT NULL DEFAULT 'bottom',
  status              subtitle_status   NOT NULL DEFAULT 'pending',
  burn_in_error       TEXT,
  auto_applied        BOOLEAN           NOT NULL DEFAULT FALSE,
  applied_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subtitles_job_id ON public.subtitles(job_id);

CREATE TRIGGER trg_subtitles_updated_at
  BEFORE UPDATE ON public.subtitles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 12. EFFECTS
-- ============================================================

CREATE TABLE public.effects (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID             NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  category    effect_category  NOT NULL,
  intensity   NUMERIC(4,2)     NOT NULL DEFAULT 0.8 CHECK (intensity BETWEEN 0 AND 1),
  timestamp   NUMERIC(10,3),
  label       TEXT,
  emoji       TEXT,
  video_url   TEXT,
  status      effect_status    NOT NULL DEFAULT 'pending',
  error       TEXT,
  applied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_effects_job_id ON public.effects(job_id);

CREATE TRIGGER trg_effects_updated_at
  BEFORE UPDATE ON public.effects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 13. SHORTS
-- ============================================================

CREATE TABLE public.shorts (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID                NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  index               INTEGER             NOT NULL,
  start_sec           NUMERIC(10,3)       NOT NULL,
  end_sec             NUMERIC(10,3)       NOT NULL,
  duration            NUMERIC(10,3),
  semantic_score      NUMERIC(5,4),
  completeness        NUMERIC(5,4),
  overall_score       NUMERIC(5,4),
  emotional_peak      BOOLEAN             DEFAULT FALSE,
  narrative_structure narrative_structure,
  why_good            TEXT,
  text_preview        TEXT,
  url                 TEXT,
  status              short_status        NOT NULL DEFAULT 'pending',
  error               TEXT,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shorts_job_id ON public.shorts(job_id, index);

-- ============================================================
-- 14. ANALYTICS
-- ============================================================

CREATE TABLE public.analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  job_id      UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  client_ip   INET,
  user_agent  TEXT,
  extra       JSONB                DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_event   ON public.analytics(event);
CREATE INDEX idx_analytics_job_id  ON public.analytics(job_id);
CREATE INDEX idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX idx_analytics_created ON public.analytics(created_at DESC);

-- ============================================================
-- 15. BETA_SIGNUPS
-- ============================================================

CREATE TABLE public.beta_signups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  client_ip   INET,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'verified', 'unsubscribed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_beta_signups_email ON public.beta_signups(email);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_outputs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.effects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shorts            ENABLE ROW LEVEL SECURITY;
-- analytics & beta_signups: service_role ile erişilir, kullanıcıya kapalı

-- users: kendi satırı
CREATE POLICY "users: kendi satırını gör" ON public.users
  FOR ALL USING (id = auth.uid());

-- jobs: kendi job'ları
CREATE POLICY "jobs: kendi kayıtları" ON public.jobs
  FOR ALL USING (user_id = auth.uid());

-- jobs'a bağlı tablolar: job sahibiyse erişebilir
CREATE POLICY "chat_messages: job sahibi" ON public.chat_messages
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "edit_confirmations: job sahibi" ON public.edit_confirmations
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "edit_jobs: job sahibi" ON public.edit_jobs
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "transcripts: job sahibi" ON public.transcripts
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "analysis_results: job sahibi" ON public.analysis_results
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "edit_plans: job sahibi" ON public.edit_plans
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "scores: job sahibi" ON public.scores
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "video_outputs: job sahibi" ON public.video_outputs
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "subtitles: job sahibi" ON public.subtitles
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "effects: job sahibi" ON public.effects
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "shorts: job sahibi" ON public.shorts
  FOR ALL USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
  );

-- ============================================================
-- VIEW: job_summary — bir job'ın tam özeti
-- ============================================================

CREATE VIEW public.job_summary AS
SELECT
  j.id                AS job_id,
  j.user_id,
  j.filename,
  j.duration          AS input_duration,
  j.status,
  j.platform,
  j.created_at,
  ej.status           AS edit_status,
  ej.progress         AS edit_progress,
  vo.output_url,
  vo.duration         AS output_duration,
  s.info_density,
  s.pacing_score,
  ar.viral_score,
  ar.one_line_summary
FROM public.jobs j
LEFT JOIN LATERAL (
  SELECT * FROM public.edit_jobs WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1
) ej ON TRUE
LEFT JOIN LATERAL (
  SELECT * FROM public.video_outputs WHERE job_id = j.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1
) vo ON TRUE
LEFT JOIN LATERAL (
  SELECT * FROM public.scores WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1
) s ON TRUE
LEFT JOIN LATERAL (
  SELECT * FROM public.analysis_results WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1
) ar ON TRUE;
