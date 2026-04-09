-- Create RPC to calculate group fares from fare_transactions
-- This sums up all fare_transactions for a group and sets fare_total on ride_groups

DROP FUNCTION IF EXISTS public.recalculate_group_fares(UUID);

CREATE FUNCTION public.recalculate_group_fares(p_group_id UUID)
RETURNS void AS $$
DECLARE
  v_total_fare NUMERIC;
BEGIN
  -- Sum all fare_transactions for this group
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_fare
  FROM fare_transactions
  WHERE group_id = p_group_id
    AND status IN ('pending', 'paid');

  -- Update ride_groups with total fare
  UPDATE ride_groups
  SET fare_total = v_total_fare
  WHERE id = p_group_id;

  RAISE NOTICE 'Group % fare updated to %', p_group_id, v_total_fare;
END;
$$ LANGUAGE plpgsql;
