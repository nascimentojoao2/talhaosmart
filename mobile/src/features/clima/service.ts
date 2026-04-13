import type { WeatherForecastRequest, WeatherProvider } from './types';
import { openMeteoWeatherProvider } from './providers/openMeteoWeatherProvider';

export class WeatherService {
  constructor(private provider: WeatherProvider) {}

  get providerName() {
    return this.provider.name;
  }

  async getForecast(request: WeatherForecastRequest) {
    return this.provider.getForecast(request);
  }
}

export function createWeatherService(provider: WeatherProvider) {
  return new WeatherService(provider);
}

export const weatherService = createWeatherService(openMeteoWeatherProvider);
