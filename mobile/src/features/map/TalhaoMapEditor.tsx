import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import type { Coordinate } from '../talhoes/types';
import { DEFAULT_REGION, calculateAreaInHectares, getRegionForCoordinates, withAlpha } from './geometry';

export type TalhaoMapEditorHandle = {
  fitToDrawing: () => void;
};

type TalhaoMapEditorProps = {
  points: Coordinate[];
  onChangePoints: (points: Coordinate[]) => void;
  polygonColor?: string;
  height?: number;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0d1f17'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  helper: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(8,28,21,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 240
  },
  helperTitle: {
    color: '#f4fff7',
    fontSize: 12,
    fontWeight: '700'
  },
  helperText: {
    color: '#bfd7c7',
    fontSize: 12,
    marginTop: 4
  }
});

export const TalhaoMapEditor = forwardRef<TalhaoMapEditorHandle, TalhaoMapEditorProps>(function TalhaoMapEditor(
  {
    points,
    onChangePoints,
    polygonColor = '#f4d35e',
    height = 320
  },
  ref
) {
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(() => getRegionForCoordinates(points, DEFAULT_REGION), [points]);
  const areaHa = useMemo(() => calculateAreaInHectares(points), [points]);

  function fitToDrawing() {
    if (!mapRef.current || points.length < 2) return;

    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true
    });
  }

  useImperativeHandle(ref, () => ({
    fitToDrawing
  }));

  useEffect(() => {
    if (points.length < 2) return;

    const timeout = setTimeout(() => {
      fitToDrawing();
    }, 150);

    return () => clearTimeout(timeout);
  }, [points]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onPress={(event) => {
          onChangePoints([...points, event.nativeEvent.coordinate]);
        }}
      >
        {points.map((point, index) => (
          <Marker key={`${point.latitude}-${point.longitude}-${index}`} coordinate={point} />
        ))}

        {points.length >= 3 && (
          <Polygon
            coordinates={points}
            strokeColor={polygonColor}
            fillColor={withAlpha(polygonColor, 0.26)}
            strokeWidth={3}
          />
        )}
      </MapView>

      <View style={styles.helper}>
        <Text style={styles.helperTitle}>Desenho do talhão</Text>
        <Text style={styles.helperText}>
          Toque no mapa para adicionar pontos. Área estimada: {areaHa.toFixed(2)} ha.
        </Text>
      </View>
    </View>
  );
});
