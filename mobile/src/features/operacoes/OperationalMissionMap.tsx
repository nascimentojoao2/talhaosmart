import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import {
  getPolygonLabelCoordinate,
  getTalhaoCoordinates,
  getTalhaoMapColor,
  getTalhaoRegion,
  withAlpha
} from '../map/geometry';
import type { Coordinate, Talhao } from '../talhoes/types';
import type {
  OperacaoGeoJsonFeature,
  OperacaoLineStringGeoJson,
  PlanejamentoOuMissao
} from './types';

type OperationalMissionMapProps = {
  talhao: Talhao;
  planejamento: PlanejamentoOuMissao | null;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0d1f17'
  },
  map: {
    width: '100%',
    height: 320
  },
  helper: {
    color: '#bfd7c7',
    lineHeight: 20
  },
  labelContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 160
  },
  labelText: {
    color: '#f4fff7',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  }
});

function toCoordinate(point: number[]) {
  return {
    longitude: point[0],
    latitude: point[1]
  };
}

function toCoordinates(line: number[][]) {
  return line.map(toCoordinate);
}

function isLineFeature(feature: OperacaoGeoJsonFeature): feature is OperacaoGeoJsonFeature<OperacaoLineStringGeoJson> {
  return feature.geometry?.type === 'LineString';
}

export function OperationalMissionMap({ talhao, planejamento }: OperationalMissionMapProps) {
  const mapRef = useRef<MapView>(null);
  const talhaoCoordinates = useMemo(() => getTalhaoCoordinates(talhao), [talhao]);
  const talhaoColor = useMemo(() => getTalhaoMapColor(talhao.id), [talhao.id]);
  const labelCoordinate = useMemo(() => getPolygonLabelCoordinate(talhaoCoordinates), [talhaoCoordinates]);
  const routeFeatures = planejamento?.rota_geojson?.features || [];

  const passLines = useMemo(() => {
    return routeFeatures
      .filter(isLineFeature)
      .filter((feature) => feature.properties?.kind === 'pass')
      .map((feature) => ({
        key: `pass-${feature.properties?.ordem || Math.random()}`,
        coordinates: toCoordinates(feature.geometry.coordinates)
      }));
  }, [routeFeatures]);

  const routeLine = useMemo(() => {
    return routeFeatures
      .filter(isLineFeature)
      .find((feature) => feature.properties?.kind === 'route') || null;
  }, [routeFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;

    const routeCoordinates = routeLine ? toCoordinates(routeLine.geometry.coordinates) : [];
    const allPoints = [...talhaoCoordinates, ...routeCoordinates];
    if (!allPoints.length) return;

    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(allPoints, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true
      });
    }, 180);

    return () => clearTimeout(timeout);
  }, [talhao.id, talhaoCoordinates, routeLine]);

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={getTalhaoRegion(talhao)}>
        <Polygon
          coordinates={talhaoCoordinates}
          strokeColor={talhaoColor}
          fillColor={withAlpha(talhaoColor, 0.22)}
          strokeWidth={2}
        />

        {passLines.map((line) => (
          <Polyline
            key={line.key}
            coordinates={line.coordinates}
            strokeColor={withAlpha('#f4fff7', 0.45)}
            strokeWidth={2}
          />
        ))}

        {routeLine && (
          <Polyline
            coordinates={toCoordinates(routeLine.geometry.coordinates)}
            strokeColor="#f4d35e"
            strokeWidth={4}
          />
        )}

        {labelCoordinate && (
          <Marker coordinate={labelCoordinate}>
            <View
              style={[
                styles.labelContainer,
                {
                  backgroundColor: withAlpha(talhaoColor, 0.9),
                  borderColor: withAlpha('#081c15', 0.35)
                }
              ]}
            >
              <Text style={styles.labelText} numberOfLines={1}>
                {talhao.nome}
              </Text>
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}
