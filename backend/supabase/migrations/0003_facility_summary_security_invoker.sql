-- facility_summary currently runs with its owner's privileges rather than
-- the querying role's, so it silently bypasses RLS on all five base tables
-- (facilities, facility_readings, facility_exceedance, facility_forecast,
-- nws_comparison) for anyone granted SELECT on the view. Not exploitable
-- today -- every base table's RLS policy is "public read, using (true)" --
-- but it's a footgun: tightening any base table's RLS later (e.g. scoping
-- nws_comparison to authenticated users) would silently do nothing here.
alter view facility_summary set (security_invoker = true);
