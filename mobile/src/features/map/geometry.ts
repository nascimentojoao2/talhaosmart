import { area as turfArea, centerOfMass, polygon as turfPolygon } from '@turf/turf';
import type { Region } from 'react-native-maps';
import type { Coordinate, PolygonGeoJson, Talhao } from '../talhoes/types';

const DEFAULT_REGION: Region = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
};

const TALHAO_MAP_COLORS = [
  '#f4d35e',
  '#90be6d',
  '#43aa8b',
  '#577590',
  '#f28482',
  '#7dcfb6',
  '#ffb703',
  '#8ecae6'
];

function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3
    ? cleanHex.split('').map((char) => `${char}${char}`).join('')
    : cleanHex;

  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getTalhaoMapColor(talhaoId: number) {
  return TALHAO_MAP_COLORS[talhaoId % TALHAO_MAP_COLORS.length];
}

export function normalizePolygonCoordinates(points: Coordinate[]) {
  if (!points.length) return [];

  const closedPoints = [...points];
  const first = closedPoints[0];
  const last = closedPoints[closedPoints.length - 1];

  if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
    closedPoints.push({ ...first });
  }

  return closedPoints;
}

export function coordinatesToGeoJson(points: Coordinate[]): PolygonGeoJson {
  return {
    type: 'Polygon',
    coordinates: [
      normalizePolygonCoordinates(points).map((point) => [point.longitude, point.latitude])
    ]
  };
}

export function geoJsonToCoordinates(geojson?: PolygonGeoJson | null): Coordinate[] {
  const coordinates = geojson?.coordinates?.[0] || [];
  if (!coordinates.length) return [];

  const mapped = coordinates.map((coordinate) => ({
    longitude: coordinate[0],
    latitude: coordinate[1]
  }));

  if (mapped.length > 1) {
    const first = mapped[0];
    const last = mapped[mapped.length - 1];

    if (first.latitude === last.latitude && first.longitude === last.longitude) {
      return mapped.slice(0, -1);
    }
  }

  return mapped;
}

export function calculateAreaInHectares(points: Coordinate[]) {
  if (points.length < 3) return 0;

  try {
    const polygon = turfPolygon([
      normalizePolygonCoordinates(points).map((point) => [point.longitude, point.latitude])
    ]);

    return turfArea(polygon) / 10000;
  } catch {
    return 0;
  }
}

export function getRegionForCoordinates(points: Coordinate[], fallback: Region = DEFAULT_REGION): Region {
  if (!points.length) return fallback;

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.005, (maxLatitude - minLatitude) * 1.8 || 0.01),
    longitudeDelta: Math.max(0.005, (maxLongitude - minLongitude) * 1.8 || 0.01)
  };
}

export function getTalhaoCoordinates(talhao: Talhao) {
  return geoJsonToCoordinates(talhao.geojson);
}

export function getTalhaoRegion(talhao: Talhao) {
  return getRegionForCoordinates(getTalhaoCoordinates(talhao));
}

export function getTalhoesRegion(talhoes: Talhao[], fallback: Region = DEFAULT_REGION) {
  const allCoordinates = talhoes.flatMap((talhao) => getTalhaoCoordinates(talhao));
  return getRegionForCoordinates(allCoordinates, fallback);
}

export function getPolygonLabelCoordinate(points: Coordinate[]) {
  if (points.length < 3) return points[0] || null;

  try {
    const polygon = turfPolygon([
      normalizePolygonCoordinates(points).map((point) => [point.longitude, point.latitude])
    ]);

    const center = centerOfMass(polygon).geometry.coordinates;

    return {
      longitude: center[0],
      latitude: center[1]
    };
  } catch {
    const region = getRegionForCoordinates(points);
    return {
      latitude: region.latitude,
      longitude: region.longitude
    };
  }
}

export function toGeoJsonFeature(talhao: Talhao) {
  return {
    type: 'Feature' as const,
    properties: {
      id: talhao.id,
      nome: talhao.nome,
      area: talhao.area,
      propriedade_id: talhao.propriedade_id,
      propriedade_nome: talhao.propriedade_nome || null
    },
    geometry: talhao.geojson
  };
}

export function toGeoJsonFeatureCollection(talhoes: Talhao[]) {
  return {
    type: 'FeatureCollection' as const,
    features: talhoes.map(toGeoJsonFeature)
  };
}

export function toKmlCoordinateString(points: Coordinate[]) {
  return normalizePolygonCoordinates(points)
    .map((point) => `${point.longitude},${point.latitude},0`)
    .join(' ');
}

export function toKmlPlacemark(talhao: Talhao) {
  return {
    id: talhao.id,
    name: talhao.nome,
    propriedadeNome: talhao.propriedade_nome || '',
    coordinates: toKmlCoordinateString(getTalhaoCoordinates(talhao))
  };
}

export { DEFAULT_REGION };
