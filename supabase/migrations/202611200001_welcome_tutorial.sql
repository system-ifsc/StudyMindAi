-- Preferência persistente por conta; perfis existentes recebem o passeio no próximo acesso.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_completed boolean NOT NULL DEFAULT false;
