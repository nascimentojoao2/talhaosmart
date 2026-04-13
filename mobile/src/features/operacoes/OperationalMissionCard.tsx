import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import type { Talhao } from '../talhoes/types';
import { OperationalMissionMap } from './OperationalMissionMap';
import {
  exportarTalhoesOperacionais,
  gerarPlanejamentoOperacional,
  listarMissoesOperacionais,
  salvarMissaoOperacional
} from './service';
import type {
  ExportacaoOperacional,
  MissaoOperacional,
  PlanejamentoOperacional,
  PlanejamentoOuMissao
} from './types';

type OperationalMissionCardProps = {
  token: string | null;
  selectedTalhao: Talhao | null;
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
  input: {
    backgroundColor: '#f7fff9',
    borderRadius: 12,
    padding: 14,
    color: '#173025'
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  primaryButton: {
    backgroundColor: '#f4d35e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  secondaryButton: {
    backgroundColor: '#163528',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  tertiaryButton: {
    backgroundColor: '#163528',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: '#173025',
    fontWeight: '800'
  },
  secondaryButtonText: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  errorBox: {
    backgroundColor: 'rgba(217,83,79,0.18)',
    borderRadius: 12,
    padding: 12
  },
  errorText: {
    color: '#ffd6d4',
    fontWeight: '600'
  },
  infoBox: {
    backgroundColor: 'rgba(244,211,94,0.16)',
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  infoTitle: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  infoText: {
    color: '#bfd7c7'
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  metricCard: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  metricValue: {
    color: '#f4d35e',
    fontSize: 22,
    fontWeight: '800'
  },
  metricLabel: {
    color: '#bfd7c7'
  },
  sectionTitle: {
    color: '#f4fff7',
    fontSize: 16,
    fontWeight: '700'
  },
  missionItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  missionItemSelected: {
    borderWidth: 1,
    borderColor: 'rgba(244,211,94,0.45)'
  },
  missionName: {
    color: '#f4fff7',
    fontWeight: '700',
    fontSize: 16
  },
  missionMeta: {
    color: '#bfd7c7'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  modalScreen: {
    flexGrow: 1,
    backgroundColor: '#081c15',
    padding: 16,
    gap: 16
  },
  modalCard: {
    backgroundColor: '#112b21',
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  exportContent: {
    color: '#f4fff7',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace'
  },
  smallMuted: {
    color: '#8fb09a',
    fontSize: 12
  }
});

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function parseLarguraFaixa(value: string) {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildMissionName(talhao: Talhao | null) {
  if (!talhao) return '';
  const stamp = new Date().toLocaleDateString('pt-BR');
  return `Missão ${talhao.nome} ${stamp}`;
}

function formatMeters(value: number) {
  return `${Math.round(value)} m`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function OperationalMissionCard({ token, selectedTalhao }: OperationalMissionCardProps) {
  const [missaoNome, setMissaoNome] = useState('');
  const [larguraFaixa, setLarguraFaixa] = useState('18');
  const [erro, setErro] = useState('');
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingMission, setSavingMission] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [missions, setMissions] = useState<MissaoOperacional[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PlanejamentoOperacional | null>(null);
  const [exportacao, setExportacao] = useState<ExportacaoOperacional | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  async function loadMissions(currentTalhao = selectedTalhao) {
    if (!token || !currentTalhao) {
      setMissions([]);
      setSelectedMissionId(null);
      return;
    }

    setLoadingMissions(true);
    try {
      const nextMissions = await listarMissoesOperacionais(token, currentTalhao.id);
      setMissions(nextMissions);
      setSelectedMissionId((current) => current && nextMissions.some((mission) => mission.id === current)
        ? current
        : nextMissions[0]?.id || null);
    } catch (error) {
      setErro(getErrorMessage(error, 'Não foi possível carregar as missões operacionais deste talhão.'));
    } finally {
      setLoadingMissions(false);
    }
  }

  useEffect(() => {
    setErro('');
    setPreview(null);

    if (!selectedTalhao) {
      setMissions([]);
      setSelectedMissionId(null);
      setMissaoNome('');
      return;
    }

    setMissaoNome(buildMissionName(selectedTalhao));
    void loadMissions(selectedTalhao);
  }, [selectedTalhao?.id, token]);

  const selectedMission = useMemo(() => {
    return missions.find((mission) => mission.id === selectedMissionId) || missions[0] || null;
  }, [missions, selectedMissionId]);

  const activePlan = useMemo<PlanejamentoOuMissao | null>(() => {
    return preview || selectedMission || null;
  }, [preview, selectedMission]);

  async function handleGeneratePreview() {
    if (!token || !selectedTalhao) return;

    const largura = parseLarguraFaixa(larguraFaixa);
    if (!largura) {
      setErro('Informe uma largura de faixa válida em metros.');
      return;
    }

    setErro('');
    setLoadingPreview(true);
    try {
      const data = await gerarPlanejamentoOperacional(token, selectedTalhao.id, largura);
      setPreview(data.planejamento);
      setSelectedMissionId(null);
      Alert.alert('Rota gerada', data.message || 'A rota de pulverização foi calculada com sucesso.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível gerar a rota operacional.');
      setErro(message);
      Alert.alert('Falha ao gerar rota', message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSaveMission() {
    if (!token || !selectedTalhao) return;

    const largura = parseLarguraFaixa(larguraFaixa);
    if (!largura) {
      setErro('Informe uma largura de faixa válida em metros.');
      return;
    }

    const nome = missaoNome.trim();
    if (!nome) {
      setErro('Informe um nome para a missão operacional.');
      return;
    }

    setErro('');
    setSavingMission(true);
    try {
      const data = await salvarMissaoOperacional(token, {
        talhaoId: selectedTalhao.id,
        larguraFaixa: largura,
        nome
      });
      setPreview(null);
      await loadMissions(selectedTalhao);
      setSelectedMissionId(data.missao.id);
      Alert.alert('Missão salva', data.message || 'A missão operacional foi salva com sucesso.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível salvar a missão operacional.');
      setErro(message);
      Alert.alert('Falha ao salvar missão', message);
    } finally {
      setSavingMission(false);
    }
  }

  async function handleExport(format: 'geojson' | 'kml', talhaoOnly: boolean) {
    if (!token) return;

    const exportKey = `${format}-${talhaoOnly ? 'selected' : 'all'}`;
    setErro('');
    setExportingKey(exportKey);

    try {
      const data = await exportarTalhoesOperacionais(token, {
        format,
        talhaoId: talhaoOnly ? selectedTalhao?.id || null : null
      });
      setExportacao(data);
      setExportModalVisible(true);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível gerar a exportação solicitada.');
      setErro(message);
      Alert.alert('Falha na exportação', message);
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>Operação do talhão</Text>
        <Text style={styles.subtitle}>Planeje pulverização por faixa, salve missões e exporte talhões em GeoJSON ou KML.</Text>
      </View>

      {erro ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{erro}</Text>
        </View>
      ) : null}

      {!selectedTalhao ? (
        <>
          <Text style={styles.helperText}>Selecione um talhão para gerar uma missão operacional com rota de pulverização baseada no polígono.</Text>
          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('geojson', false); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'geojson-all' ? 'Exportando...' : 'Exportar todos em GeoJSON'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('kml', false); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'kml-all' ? 'Exportando...' : 'Exportar todos em KML'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.helperText}>
            {selectedTalhao.propriedade_nome ? `${selectedTalhao.propriedade_nome} • ${selectedTalhao.nome}` : selectedTalhao.nome}
          </Text>

          <TextInput
            value={missaoNome}
            onChangeText={(value) => {
              setMissaoNome(value);
              if (erro) setErro('');
            }}
            placeholder="Nome da missão operacional"
            placeholderTextColor="#777"
            style={styles.input}
          />

          <TextInput
            value={larguraFaixa}
            onChangeText={(value) => {
              setLarguraFaixa(value);
              if (erro) setErro('');
            }}
            placeholder="Largura de faixa em metros"
            placeholderTextColor="#777"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={loadingPreview || savingMission}
              onPress={() => { void handleGeneratePreview(); }}
            >
              <Text style={styles.secondaryButtonText}>{loadingPreview ? 'Gerando...' : 'Gerar rota'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={loadingPreview || savingMission}
              onPress={() => { void handleSaveMission(); }}
            >
              <Text style={styles.primaryButtonText}>{savingMission ? 'Salvando...' : 'Salvar missão'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('geojson', true); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'geojson-selected' ? 'Exportando...' : 'GeoJSON do talhão'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('kml', true); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'kml-selected' ? 'Exportando...' : 'KML do talhão'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('geojson', false); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'geojson-all' ? 'Exportando...' : 'GeoJSON de todos'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              disabled={!!exportingKey}
              onPress={() => { void handleExport('kml', false); }}
            >
              <Text style={styles.secondaryButtonText}>{exportingKey === 'kml-all' ? 'Exportando...' : 'KML de todos'}</Text>
            </TouchableOpacity>
          </View>

          {loadingPreview && (
            <View style={styles.statusRow}>
              <ActivityIndicator color="#f4d35e" />
              <Text style={styles.helperText}>Calculando passadas, orientação e rota ideal dentro do polígono...</Text>
            </View>
          )}

          {preview && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Prévia pronta</Text>
              <Text style={styles.infoText}>A rota exibida abaixo ainda não foi salva. Revise e confirme para registrar a missão operacional.</Text>
            </View>
          )}

          {activePlan ? (
            <>
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{formatMeters(activePlan.largura_faixa)}</Text>
                  <Text style={styles.metricLabel}>Faixa configurada</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{Math.round(activePlan.orientacao_graus)}°</Text>
                  <Text style={styles.metricLabel}>Orientação da rota</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{activePlan.estatisticas.total_passadas}</Text>
                  <Text style={styles.metricLabel}>Passadas geradas</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{formatMeters(activePlan.estatisticas.distancia_total_m)}</Text>
                  <Text style={styles.metricLabel}>Distância total</Text>
                </View>
              </View>

              <Text style={styles.helperText}>
                Faixa efetiva calculada: {formatMeters(activePlan.estatisticas.largura_faixa_efetiva_m)}.
                Passadas: {formatMeters(activePlan.estatisticas.comprimento_passadas_m)}.
                Transições: {formatMeters(activePlan.estatisticas.distancia_transicao_m)}.
              </Text>

              <OperationalMissionMap talhao={selectedTalhao} planejamento={activePlan} />
            </>
          ) : (
            <Text style={styles.helperText}>Gere uma rota ou selecione uma missão salva para visualizar a malha operacional sobre o talhão.</Text>
          )}

          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Missões salvas</Text>
            {loadingMissions ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color="#f4d35e" />
                <Text style={styles.helperText}>Carregando missões deste talhão...</Text>
              </View>
            ) : missions.length === 0 ? (
              <Text style={styles.helperText}>Nenhuma missão salva ainda para este talhão.</Text>
            ) : (
              missions.map((mission) => (
                <TouchableOpacity
                  key={mission.id}
                  style={[styles.missionItem, selectedMissionId === mission.id && styles.missionItemSelected]}
                  onPress={() => {
                    setPreview(null);
                    setSelectedMissionId(mission.id);
                  }}
                >
                  <Text style={styles.missionName}>{mission.nome}</Text>
                  <Text style={styles.missionMeta}>
                    {formatDate(mission.created_at)} • faixa {formatMeters(mission.largura_faixa)} • {mission.estatisticas.total_passadas} passadas
                  </Text>
                  <Text style={styles.smallMuted}>
                    Distância total: {formatMeters(mission.estatisticas.distancia_total_m)} • orientação {Math.round(mission.orientacao_graus)}°
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}

      <Modal visible={exportModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#081c15' }}>
          <ScrollView contentContainerStyle={styles.modalScreen}>
            <View style={styles.modalCard}>
              <Text style={styles.title}>Exportação operacional</Text>
              <Text style={styles.subtitle}>
                {exportacao
                  ? `${exportacao.filename} • ${exportacao.total_talhoes} talhão(ões) • ${exportacao.format.toUpperCase()}`
                  : 'Nenhum conteúdo carregado.'}
              </Text>
            </View>

            {exportacao && (
              <View style={styles.modalCard}>
                <Text style={styles.sectionTitle}>Conteúdo gerado</Text>
                <Text style={styles.smallMuted}>
                  O backend já retorna o conteúdo pronto. Esta visualização deixa o app preparado para uma próxima etapa com compartilhamento e download nativos.
                </Text>
                <Text style={styles.exportContent}>{exportacao.content}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setExportModalVisible(false);
                setExportacao(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Fechar exportação</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
