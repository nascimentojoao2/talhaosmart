import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Talhao } from '../talhoes/types';
import type { TalhaoWeatherState } from './types';

type TalhaoWeatherCardProps = {
  title: string;
  subtitle?: string;
  talhao: Talhao | null;
  state: TalhaoWeatherState;
  onRetry?: () => void;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#112b21',
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  title: {
    color: '#f4fff7',
    fontSize: 20,
    fontWeight: '700'
  },
  subtitle: {
    color: '#bfd7c7'
  },
  helperText: {
    color: '#bfd7c7',
    lineHeight: 20
  },
  currentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  currentItem: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  metricValue: {
    color: '#f4d35e',
    fontSize: 24,
    fontWeight: '800'
  },
  metricLabel: {
    color: '#bfd7c7'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  errorBox: {
    backgroundColor: 'rgba(217,83,79,0.18)',
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  errorText: {
    color: '#ffd6d4',
    fontWeight: '600'
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#163528',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  retryText: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  alertsRow: {
    gap: 8
  },
  alertBox: {
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  alertWarning: {
    backgroundColor: 'rgba(244, 211, 94, 0.18)'
  },
  alertInfo: {
    backgroundColor: 'rgba(125, 207, 182, 0.16)'
  },
  alertTitle: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  alertDescription: {
    color: '#bfd7c7'
  },
  forecastTitle: {
    color: '#f4fff7',
    fontSize: 16,
    fontWeight: '700'
  },
  hourlyCard: {
    minWidth: 116,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginRight: 10
  },
  hourlyTime: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  hourlyValue: {
    color: '#f4d35e',
    fontSize: 18,
    fontWeight: '800'
  },
  hourlyMeta: {
    color: '#bfd7c7',
    fontSize: 12
  },
  updatedAt: {
    color: '#8fb09a',
    fontSize: 12
  }
});

function formatHourLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TalhaoWeatherCard({ title, subtitle, talhao, state, onRetry }: TalhaoWeatherCardProps) {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {!talhao ? (
        <Text style={styles.helperText}>Selecione um talhão para consultar o clima e a previsão por hora.</Text>
      ) : (
        <>
          <Text style={styles.helperText}>
            {talhao.propriedade_nome ? `${talhao.propriedade_nome} • ${talhao.nome}` : talhao.nome}
          </Text>

          {state.status === 'loading' && !state.data && (
            <View style={styles.statusRow}>
              <ActivityIndicator color="#f4d35e" />
              <Text style={styles.helperText}>Carregando previsão deste talhão...</Text>
            </View>
          )}

          {state.status === 'error' && !state.data && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{state.error || 'Não foi possível carregar o clima deste talhão.'}</Text>
              {!!onRetry && (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {state.data && (
            <>
              {state.status === 'loading' && (
                <View style={styles.statusRow}>
                  <ActivityIndicator color="#f4d35e" />
                  <Text style={styles.helperText}>Atualizando previsão...</Text>
                </View>
              )}

              {state.status === 'error' && state.error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{state.error}</Text>
                  {!!onRetry && (
                    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                      <Text style={styles.retryText}>Atualizar agora</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.currentRow}>
                <View style={styles.currentItem}>
                  <Text style={styles.metricValue}>{Math.round(state.data.current.temperature)}°C</Text>
                  <Text style={styles.metricLabel}>Temperatura atual</Text>
                </View>
                <View style={styles.currentItem}>
                  <Text style={styles.metricValue}>{Math.round(state.data.current.windSpeed)}</Text>
                  <Text style={styles.metricLabel}>Vento km/h</Text>
                </View>
                <View style={styles.currentItem}>
                  <Text style={styles.metricValue}>{Math.round(state.data.current.precipitation)}</Text>
                  <Text style={styles.metricLabel}>Chuva mm</Text>
                </View>
              </View>

              <Text style={styles.helperText}>{state.data.current.description}</Text>

              {state.data.alerts.length > 0 && (
                <View style={styles.alertsRow}>
                  {state.data.alerts.map((alert) => (
                    <View
                      key={alert.id}
                      style={[
                        styles.alertBox,
                        alert.severity === 'warning' ? styles.alertWarning : styles.alertInfo
                      ]}
                    >
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text style={styles.alertDescription}>{alert.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View>
                <Text style={styles.forecastTitle}>Próximas horas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {state.data.hourly.map((item) => (
                    <View key={item.time} style={styles.hourlyCard}>
                      <Text style={styles.hourlyTime}>{formatHourLabel(item.time)}</Text>
                      <Text style={styles.hourlyValue}>{Math.round(item.temperature)}°C</Text>
                      <Text style={styles.hourlyMeta}>{item.description}</Text>
                      <Text style={styles.hourlyMeta}>Chuva: {Math.round(item.precipitationProbability)}%</Text>
                      <Text style={styles.hourlyMeta}>Vento: {Math.round(item.windSpeed)} km/h</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.updatedAt}>Atualizado em {formatUpdatedAt(state.data.fetchedAt)} via {state.data.provider}</Text>
            </>
          )}
        </>
      )}
    </View>
  );
}
