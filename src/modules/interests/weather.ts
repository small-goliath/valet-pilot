import axios from 'axios';
import type { Interest } from '../../types/config.js';

interface OWMResponse {
  weather: { description: string }[];
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  name: string;
}

export interface WeatherData {
  location: string;
  description: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
}

export async function fetchWeather(interest: Interest): Promise<WeatherData> {
  const { api_key, location } = interest.auth;

  const res = await axios.get<OWMResponse>('https://api.openweathermap.org/data/2.5/weather', {
    params: { q: location, appid: api_key, units: 'metric', lang: 'kr' },
    timeout: 8000,
  });

  const d = res.data;
  return {
    location: d.name,
    description: d.weather[0]?.description ?? '',
    temp: Math.round(d.main.temp),
    feelsLike: Math.round(d.main.feels_like),
    humidity: d.main.humidity,
    windSpeed: d.wind.speed,
  };
}
