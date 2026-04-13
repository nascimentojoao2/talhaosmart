export type WeatherAlertSeverity = 'info' | 'warning';

export type WeatherAlert = {
  id: string;
  title: string;
  description: string;
  severity: WeatherAlertSeverity;
};

export type WeatherCurrent = {
  time: string;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  description: string;
};

export type WeatherHourlyForecastItem = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
};

export type TalhaoWeatherForecast = {
  provider: string;
  timezone: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  current: WeatherCurrent;
  hourly: WeatherHourlyForecastItem[];
  alerts: WeatherAlert[];
};

export type TalhaoWeatherStateStatus = 'idle' | 'loading' | 'success' | 'error';

export type TalhaoWeatherState = {
  status: TalhaoWeatherStateStatus;
  data: TalhaoWeatherForecast | null;
  error: string | null;
};

export type WeatherForecastRequest = {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourlyLimit?: number;
};

export type WeatherProvider = {
  name: string;
  getForecast: (request: WeatherForecastRequest) => Promise<TalhaoWeatherForecast>;
};
