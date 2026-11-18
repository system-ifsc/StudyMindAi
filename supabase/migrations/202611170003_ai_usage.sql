CREATE TABLE public.ai_usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_units integer NOT NULL CHECK(daily_units > 0),
  monthly_units integer NOT NULL CHECK(monthly_units >= daily_units),
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.ai_usage_reservations (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  units integer NOT NULL CHECK(units > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','committed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz
);
CREATE INDEX ON public.ai_usage_reservations(user_id,created_at);
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_limits,public.ai_usage_reservations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ai_usage_limits,public.ai_usage_reservations TO service_role;

CREATE FUNCTION public.reserve_ai_usage(p_user_id uuid,p_request_id uuid,p_units integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE lim public.ai_usage_limits; day_used bigint; month_used bigint;
BEGIN
  IF p_units IS NULL OR p_units < 1 THEN RAISE EXCEPTION 'invalid units'; END IF;
  SELECT * INTO lim FROM ai_usage_limits WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT lim.enabled THEN RAISE EXCEPTION 'usage disabled'; END IF;
  IF EXISTS(SELECT 1 FROM ai_usage_reservations WHERE id=p_request_id AND user_id=p_user_id) THEN RETURN; END IF;
  SELECT coalesce(sum(units) FILTER(WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0),
    coalesce(sum(units),0) INTO day_used,month_used FROM ai_usage_reservations
    WHERE user_id=p_user_id AND status <> 'cancelled'
    AND created_at >= date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF day_used+p_units > lim.daily_units OR month_used+p_units > lim.monthly_units THEN
    RAISE EXCEPTION 'usage limit exceeded';
  END IF;
  INSERT INTO ai_usage_reservations(id,user_id,units) VALUES(p_request_id,p_user_id,p_units);
END $$;
CREATE FUNCTION public.finalize_ai_usage(p_user_id uuid,p_request_id uuid,p_commit boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE ai_usage_reservations SET status=CASE WHEN p_commit THEN 'committed' ELSE 'cancelled' END, finalized_at=now()
  WHERE id=p_request_id AND user_id=p_user_id AND status='reserved';
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_ai_usage(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_usage(uuid,uuid,boolean) TO service_role;
