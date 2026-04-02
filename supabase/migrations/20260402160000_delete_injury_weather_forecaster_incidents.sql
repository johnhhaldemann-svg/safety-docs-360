-- Drop synthetic incidents created via the Injury Weather manual forecaster (tagged in title/description).
-- Safe if no rows match.

delete from public.company_incidents ci
where
  lower(coalesce(ci.title, '') || ' ' || coalesce(ci.description, '')) like '%[injury-weather-forecaster]%'
  or lower(coalesce(ci.title, '') || ' ' || coalesce(ci.description, '')) like '%[injury_weather_forecaster]%'
  or lower(coalesce(ci.title, '') || ' ' || coalesce(ci.description, '')) like '%[iw-forecaster]%'
  or lower(coalesce(ci.title, '') || ' ' || coalesce(ci.description, '')) like '%injury weather forecaster%';
