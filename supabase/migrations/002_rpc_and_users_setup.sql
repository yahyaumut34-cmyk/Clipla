-- ============================================================
-- Clipla-Y — Migration 002
-- - increment_daily_uploads RPC
-- - users tablosu eksik sütun güvenceleri
-- - signup trigger (auth.users → public.users otomatik kayıt)
-- ============================================================

-- ── users tablosunda eksik olabilecek sütunları güvence altına al ──

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_uploads_count  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_uploads_date   DATE,
  ADD COLUMN IF NOT EXISTS upgraded_at          TIMESTAMPTZ;

-- ── RPC: günlük upload sayacını artır ─────────────────────────────
-- Frontend: supabase.rpc('increment_daily_uploads', { uid: userId })

CREATE OR REPLACE FUNCTION public.increment_daily_uploads(uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO public.users (id, plan, daily_uploads_count, daily_uploads_date)
  VALUES (uid, 'free', 1, today)
  ON CONFLICT (id) DO UPDATE
    SET
      daily_uploads_count = CASE
        WHEN public.users.daily_uploads_date = today
          THEN public.users.daily_uploads_count + 1
        ELSE 1
      END,
      daily_uploads_date = today;
END;
$$;

-- Fonksiyonu sadece authenticated kullanıcılar çağırabilsin
REVOKE ALL ON FUNCTION public.increment_daily_uploads(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_daily_uploads(UUID) TO authenticated;

-- ── Signup trigger: auth.users → public.users otomatik kayıt ──────
-- Böylece signUp() sonrası usePlan() hep kayıt bulur.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, plan, daily_uploads_count, daily_uploads_date)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    0,
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger varsa önce düşür, sonra yeniden oluştur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
