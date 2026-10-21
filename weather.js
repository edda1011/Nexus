export const WEATHER_URL = 'https://api.data.gov.my/weather/forecast?contains=Ds057@location__location_id&limit=7';
export function normaliseForecast(records) {
  if (!Array.isArray(records)) throw new Error('Forecast response is not a record collection.');
  const result = records.filter(row => row?.location?.location_id === 'Ds057' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.min_temp) && Number.isFinite(row.max_temp) && row.min_temp <= row.max_temp && typeof row.summary_forecast === 'string');
  if (!result.length) throw new Error('No usable Petaling forecast records.');
  return result.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
}
