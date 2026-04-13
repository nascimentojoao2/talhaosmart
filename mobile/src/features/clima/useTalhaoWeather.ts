import { useRef, useState } from 'react';
import { getPolygonLabelCoordinate, getTalhaoCoordinates } from '../map/geometry';
import type { Talhao } from '../talhoes/types';
import { weatherService } from './service';
import type { TalhaoWeatherState } from './types';

const IDLE_WEATHER_STATE: TalhaoWeatherState = {
  status: 'idle',
  data: null,
  error: null
};

export function useTalhaoWeather() {
  const [states, setStates] = useState<Record<number, TalhaoWeatherState>>({});
  const statesRef = useRef<Record<number, TalhaoWeatherState>>({});
  const inflightRef = useRef<Record<number, Promise<void>>>({});

  function updateState(talhaoId: number, state: TalhaoWeatherState) {
    setStates((previous) => {
      const next = { ...previous, [talhaoId]: state };
      statesRef.current = next;
      return next;
    });
  }

  function getWeatherState(talhaoId?: number | null) {
    if (!talhaoId) return IDLE_WEATHER_STATE;
    return states[talhaoId] || IDLE_WEATHER_STATE;
  }

  async function loadWeatherForTalhao(talhao: Talhao, options?: { force?: boolean }) {
    const existingState = statesRef.current[talhao.id];

    if (!options?.force && existingState?.status === 'success') return;
    if (!options?.force && inflightRef.current[talhao.id]) return inflightRef.current[talhao.id];

    const center = getPolygonLabelCoordinate(getTalhaoCoordinates(talhao));

    if (!center) {
      updateState(talhao.id, {
        status: 'error',
        data: null,
        error: 'Não foi possível identificar a localização do talhão para buscar o clima.'
      });
      return;
    }

    updateState(talhao.id, {
      status: 'loading',
      data: existingState?.data || null,
      error: null
    });

    const request = weatherService.getForecast({
      latitude: center.latitude,
      longitude: center.longitude,
      hourlyLimit: 12
    })
      .then((data) => {
        updateState(talhao.id, {
          status: 'success',
          data,
          error: null
        });
      })
      .catch((error: unknown) => {
        updateState(talhao.id, {
          status: 'error',
          data: existingState?.data || null,
          error: error instanceof Error ? error.message : 'Não foi possível carregar a previsão do tempo.'
        });
      })
      .finally(() => {
        delete inflightRef.current[talhao.id];
      });

    inflightRef.current[talhao.id] = request;
    await request;
  }

  return {
    getWeatherState,
    loadWeatherForTalhao
  };
}
