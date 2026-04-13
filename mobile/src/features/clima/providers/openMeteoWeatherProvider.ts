import type { TalhaoWeatherForecast, WeatherForecastRequest, WeatherProvider } from '../types';
import { getWeatherCodeDescription } from '../weatherCodes';

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
};

function buildAlerts(hourly: TalhaoWeatherForecast['hourly']) {
  const nextHours = hourly.slice(0, 8);
  const alerts = [];

  const maxRainProbability = Math.max(0, ...nextHours.map((item) => item.precipitationProbability));
  if (maxRainProbability >= 70) {
    alerts.push({
      id: 'high-rain-probability',
      title: 'Chance alta de chuva',
      description: `A probabilidade de chuva chega a ${Math.round(maxRainProbability)}% nas próximas horas.`,
      severity: 'warning' as const
    });
  }

  const maxWindSpeed = Math.max(0, ...nextHours.map((item) => item.windSpeed));
  if (maxWindSpeed >= 35) {
    alerts.push({
      id: 'strong-wind',
      title: 'Vento forte previsto',
      description: `Rajadas podem atingir cerca de ${Math.round(maxWindSpeed)} km/h nas próximas horas.`,
      severity: 'info' as const
    });
  }

  const maxTemperature = Math.max(0, ...nextHours.map((item) => item.temperature));
  if (maxTemperature >= 32) {
    alerts.push({
      id: 'heat-attention',
      title: 'Calor elevado',
      description: `A temperatura pode chegar a ${Math.round(maxTemperature)}°C no período analisado.`,
      severity: 'info' as const
    });
  }

  return alerts;
}

export const openMeteoWeatherProvider: WeatherProvider = {
  name: 'open-meteo',
  async getForecast({ latitude, longitude, timezone = 'auto', hourlyLimit = 12 }: WeatherForecastRequest) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('current', 'temperature_2m,wind_speed_10m,precipitation,weather_code');
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error('Não foi possível consultar a previsão do tempo no momento.');
    }

    const json = await response.json() as OpenMeteoResponse;
    const hourly = json.hourly.time.slice(0, hourlyLimit).map((time, index) => ({
      time,
      temperature: json.hourly.temperature_2m[index],
      precipitationProbability: json.hourly.precipitation_probability[index],
      windSpeed: json.hourly.wind_speed_10m[index],
      weatherCode: json.hourly.weather_code[index],
      description: getWeatherCodeDescription(json.hourly.weather_code[index])
    }));

    return {
      provider: openMeteoWeatherProvider.name,
      timezone: json.timezone,
      latitude: json.latitude,
      longitude: json.longitude,
      fetchedAt: new Date().toISOString(),
      current: {
        time: json.current.time,
        temperature: json.current.temperature_2m,
        windSpeed: json.current.wind_speed_10m,
        precipitation: json.current.precipitation,
        weatherCode: json.current.weather_code,
        description: getWeatherCodeDescription(json.current.weather_code)
      },
      hourly,
      alerts: buildAlerts(hourly)
    };
  }
};
