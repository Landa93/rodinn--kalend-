CREATE OR REPLACE FUNCTION public.get_family_service_slots(
    p_family_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ
)
RETURNS TABLE (
    appointment_at TIMESTAMPTZ,
    title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
    -- Přístup mají pouze členové dané rodiny.
    IF NOT public.is_family_member(p_family_id) THEN
        RAISE EXCEPTION 'Nemáte přístup k tomuto kalendáři.';
    END IF;

    IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
        RAISE EXCEPTION 'Neplatný časový rozsah.';
    END IF;

    RETURN QUERY
    SELECT
        c.appointment_at,
        'Servis oken'::TEXT
    FROM public.customers c
    JOIN public.family_calendars f
      ON f.created_by = c.user_id
    WHERE f.id = p_family_id
      AND c.appointment_at IS NOT NULL
      AND c.appointment_at >= p_from
      AND c.appointment_at < p_to
    ORDER BY c.appointment_at;
END;
$$;

REVOKE ALL
ON FUNCTION public.get_family_service_slots(
    UUID, TIMESTAMPTZ, TIMESTAMPTZ
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_family_service_slots(
    UUID, TIMESTAMPTZ, TIMESTAMPTZ
)
TO authenticated;
