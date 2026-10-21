// Public source records. Generated from retained JSON; no invented replacements.
export const CLIMATE = {
  "latitude": 3,
  "longitude": 101.5,
  "generationtime_ms": 0.2987384796142578,
  "utc_offset_seconds": 28800,
  "timezone": "Asia/Kuala_Lumpur",
  "timezone_abbreviation": "GMT+8",
  "elevation": 20,
  "daily_units": {
    "time": "iso8601",
    "precipitation_sum": "mm",
    "et0_fao_evapotranspiration": "mm",
    "temperature_2m_max": "°C",
    "temperature_2m_min": "°C"
  },
  "daily": {
    "time": [
      "2025-07-01",
      "2025-07-02",
      "2025-07-03",
      "2025-07-04",
      "2025-07-05",
      "2025-07-06",
      "2025-07-07",
      "2025-07-08",
      "2025-07-09",
      "2025-07-10",
      "2025-07-11",
      "2025-07-12",
      "2025-07-13",
      "2025-07-14"
    ],
    "precipitation_sum": [
      0.1,
      0.9,
      0.6,
      1.2,
      0.1,
      0,
      0,
      0.7,
      1.6,
      0.2,
      0.3,
      1.6,
      3.8,
      0.1
    ],
    "et0_fao_evapotranspiration": [
      4.92,
      3.67,
      4.39,
      4.5,
      4.89,
      5.39,
      6.14,
      4.74,
      5.59,
      5.46,
      5.62,
      3.75,
      3.6,
      4.97
    ],
    "temperature_2m_max": [
      33.8,
      31.1,
      33,
      30.8,
      33,
      33.7,
      34.8,
      33.1,
      34.7,
      33.9,
      34.8,
      31.8,
      31.6,
      33.5
    ],
    "temperature_2m_min": [
      25.7,
      26.1,
      25.5,
      25.4,
      25.2,
      25.7,
      26.1,
      26.5,
      26.4,
      26.4,
      26,
      26,
      25.8,
      26.3
    ]
  },
  "retrievedAt": "2026-10-21T15:38:04.595Z",
  "sourceUrl": "https://archive-api.open-meteo.com/v1/archive?latitude=3.0738&longitude=101.5183&start_date=2025-07-01&end_date=2025-07-14&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKuala_Lumpur&models=era5",
  "provider": "Open-Meteo / ERA5",
  "type": "Public reanalysis; not a site measurement"
};
export const WEATHER_SNAPSHOT = {
  "mode": "snapshot",
  "retrievedAt": "2026-10-21T15:38:04.595Z",
  "source": "MET Malaysia via data.gov.my",
  "sourceUrl": "https://api.data.gov.my/weather/forecast?contains=Ds057@location__location_id&limit=7",
  "records": [
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-27",
      "morning_forecast": "Tiada Hujan",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Tiada Hujan",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Petang",
      "min_temp": 24,
      "max_temp": 33
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-26",
      "morning_forecast": "Tiada Hujan",
      "afternoon_forecast": "Tiada Hujan",
      "night_forecast": "Tiada Hujan",
      "summary_forecast": "Tiada Hujan",
      "summary_when": "Sepanjang Hari",
      "min_temp": 24,
      "max_temp": 33
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-25",
      "morning_forecast": "Hujan di beberapa tempat",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Hujan di beberapa tempat",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Sepanjang Hari",
      "min_temp": 24,
      "max_temp": 33
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-24",
      "morning_forecast": "Tiada Hujan",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Hujan di beberapa tempat",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Petang dan Malam",
      "min_temp": 24,
      "max_temp": 33
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-23",
      "morning_forecast": "Jerebu",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Jerebu",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Sepanjang Hari",
      "min_temp": 24,
      "max_temp": 33
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-22",
      "morning_forecast": "Jerebu",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Jerebu",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Sepanjang Hari",
      "min_temp": 25,
      "max_temp": 34
    },
    {
      "location": {
        "location_id": "Ds057",
        "location_name": "Petaling"
      },
      "date": "2026-10-21",
      "morning_forecast": "Jerebu",
      "afternoon_forecast": "Ribut petir di beberapa tempat",
      "night_forecast": "Hujan di beberapa tempat",
      "summary_forecast": "Ribut petir di beberapa tempat",
      "summary_when": "Sepanjang Hari",
      "min_temp": 25,
      "max_temp": 34
    }
  ]
};
