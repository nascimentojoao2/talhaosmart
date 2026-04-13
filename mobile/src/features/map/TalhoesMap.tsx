import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import type { Coordinate, Talhao } from '../talhoes/types';
import {
  DEFAULT_REGION,
  getPolygonLabelCoordinate,
  getTalhaoCoordinates,
  getTalhaoMapColor,
  getTalhoesRegion,
  withAlpha
} from './geometry';

export type TalhoesMapHandle = {
  fitToTalhao: (talhao: Talhao | null) => void;
  fitToTalhoes: (talhoes?: Talhao[]) => void;
};

type TalhoesMapProps = {
  talhoes: Talhao[];
  selectedTalhaoId?: number | null;
  onSelectTalhao?: (talhao: Talhao) => void;
  height?: number;
  emptyMessage?: string;
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  emptyText: {
    color: '#bfd7c7',
    textAlign: 'center'
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
  },
  centerButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(8,28,21,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  centerButtonText: {
    color: '#f4fff7',
    fontSize: 12,
    fontWeight: '700'
  }
});

export const TalhoesMap = forwardRef<TalhoesMapHandle, TalhoesMapProps>(function TalhoesMap(
  {
    talhoes,
    selectedTalhaoId = null,
    onSelectTalhao,
    height = 340,
    emptyMessage = 'Nenhum talhão disponível para exibir no mapa.'
  },
  ref
) {
  const mapRef = useRef<MapView>(null);

  const sortedTalhoes = useMemo(() => {
    return [...talhoes].sort((left, right) => {
      if (left.id === selectedTalhaoId) return 1;
      if (right.id === selectedTalhaoId) return -1;
      return left.id - right.id;
    });
  }, [selectedTalhaoId, talhoes]);

  function fitToCoordinates(points: Coordinate[]) {
    if (!mapRef.current || !points.length) return;

    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true
    });
  }

  function fitToTalhao(talhao: Talhao | null) {
    if (!talhao) return;
    fitToCoordinates(getTalhaoCoordinates(talhao));
  }

  function fitToTalhoesMap(talhoesToFit = talhoes) {
    const points = talhoesToFit.flatMap((talhao) => getTalhaoCoordinates(talhao));
    fitToCoordinates(points);
  }

  useImperativeHandle(ref, () => ({
    fitToTalhao,
    fitToTalhoes: fitToTalhoesMap
  }));

  useEffect(() => {
    if (!selectedTalhaoId) return;

    const selectedTalhao = talhoes.find((talhao) => talhao.id === selectedTalhaoId) || null;
    if (!selectedTalhao) return;

    const timeout = setTimeout(() => {
      fitToTalhao(selectedTalhao);
    }, 150);

    return () => clearTimeout(timeout);
  }, [selectedTalhaoId, talhoes]);

  const initialRegion = useMemo(() => getTalhoesRegion(talhoes, DEFAULT_REGION), [talhoes]);

  if (!talhoes.length) {
    return (
      <View style={[styles.container, styles.emptyState, { height }]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
        {sortedTalhoes.map((talhao) => {
          const points = getTalhaoCoordinates(talhao);
          const labelCoordinate = getPolygonLabelCoordinate(points);
          const color = getTalhaoMapColor(talhao.id);
          const isSelected = selectedTalhaoId === talhao.id;

          return (
            <React.Fragment key={talhao.id}>
              <Polygon
                coordinates={points}
                tappable
                strokeColor={isSelected ? '#f4fff7' : color}
                fillColor={withAlpha(color, isSelected ? 0.42 : 0.22)}
                strokeWidth={isSelected ? 4 : 2}
                onPress={() => onSelectTalhao?.(talhao)}
              />

              {labelCoordinate && (
                <Marker coordinate={labelCoordinate} onPress={() => onSelectTalhao?.(talhao)}>
                  <View
                    style={[
                      styles.labelContainer,
                      {
                        backgroundColor: withAlpha(color, isSelected ? 0.95 : 0.82),
                        borderColor: isSelected ? '#f4fff7' : withAlpha('#081c15', 0.35)
                      }
                    ]}
                  >
                    <Text style={styles.labelText} numberOfLines={1}>
                      {talhao.nome}
                    </Text>
                  </View>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => {
          const selectedTalhao = talhoes.find((talhao) => talhao.id === selectedTalhaoId) || null;
          if (selectedTalhao) {
            fitToTalhao(selectedTalhao);
            return;
          }

          fitToTalhoesMap();
        }}
      >
        <Text style={styles.centerButtonText}>{selectedTalhaoId ? 'Centralizar seleção' : 'Ajustar mapa'}</Text>
      </TouchableOpacity>
    </View>
  );
});
