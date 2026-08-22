create extension if not exists postgis;

create table facilities (
  id text primary key,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  geom geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,
  state text not null,
  county text not null,
  has_transmission boolean not null default false,
  has_water boolean not null default false,
  has_fibre boolean not null default false,
  created_at timestamptz not null default now()
);

create table facility_readings (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  ts timestamptz not null,
  air_temp_c double precision,
  wet_bulb_c double precision,
  heat_index_c double precision,
  unique (facility_id, ts)
);

create table facility_exceedance (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  threshold_c double precision not null,
  period_start date not null,
  period_end date not null,
  hours_exceeded double precision not null,
  longest_run_hours double precision not null,
  unique (facility_id, threshold_c, period_start, period_end)
);

create table facility_forecast (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  forecast_ts timestamptz not null,
  forecast_hour int not null check (forecast_hour between 0 and 11),
  predicted_wet_bulb_c double precision,
  predicted_derating_pct double precision,
  unique (facility_id, forecast_hour)
);

create table nws_comparison (
  id bigint generated always as identity primary key,
  facility_id text not null references facilities(id) on delete cascade,
  ts timestamptz not null,
  nws_temp_f double precision,
  fortyguard_temp_f double precision,
  delta_f double precision,
  unique (facility_id, ts)
);

-- Public read-only cache: no facility/thermal data here is sensitive,
-- and all writes go through the service-role key from the ETL, which
-- bypasses RLS entirely — so these policies only ever grant SELECT.
alter table facilities enable row level security;
alter table facility_readings enable row level security;
alter table facility_exceedance enable row level security;
alter table facility_forecast enable row level security;
alter table nws_comparison enable row level security;

create policy "public read" on facilities for select using (true);
create policy "public read" on facility_readings for select using (true);
create policy "public read" on facility_exceedance for select using (true);
create policy "public read" on facility_forecast for select using (true);
create policy "public read" on nws_comparison for select using (true);

create or replace view facility_summary as
with latest_reading as (
  select distinct on (facility_id) facility_id, ts, air_temp_c, wet_bulb_c, heat_index_c
  from facility_readings
  order by facility_id, ts desc
),
current_exceedance as (
  select distinct on (facility_id) facility_id, hours_exceeded, longest_run_hours
  from facility_exceedance
  order by facility_id, period_end desc
),
peak_forecast as (
  select facility_id, max(predicted_derating_pct) as peak_derating_next_12h_pct
  from facility_forecast
  group by facility_id
),
latest_nws as (
  select distinct on (facility_id) facility_id, nws_temp_f, fortyguard_temp_f, delta_f
  from nws_comparison
  order by facility_id, ts desc
)
select
  f.id, f.name, f.lat, f.lon, f.state, f.county,
  lr.air_temp_c as current_air_temp_c,
  lr.wet_bulb_c as current_wet_bulb_c,
  coalesce(ce.hours_exceeded, 0) as hours_exceeded_season,
  coalesce(ce.longest_run_hours, 0) as longest_run_hours,
  case
    when ce.longest_run_hours is null then 'safe'
    when ce.longest_run_hours >= 8 then 'critical'
    when ce.longest_run_hours >= 3 then 'watch'
    else 'safe'
  end as risk_tier,
  greatest(0, least(100, 100 - coalesce(ce.hours_exceeded, 0) / 2)) as headroom_score,
  coalesce(pf.peak_derating_next_12h_pct, 0) as peak_derating_next_12h_pct,
  ln.nws_temp_f as nws_grid_temp_f,
  ln.fortyguard_temp_f as fortyguard_local_temp_f,
  ln.delta_f
from facilities f
left join latest_reading lr on lr.facility_id = f.id
left join current_exceedance ce on ce.facility_id = f.id
left join peak_forecast pf on pf.facility_id = f.id
left join latest_nws ln on ln.facility_id = f.id;

grant select on facility_summary to anon, authenticated;
