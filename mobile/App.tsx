import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as AuthSession from 'expo-auth-session';
import { AuthActionButton } from './src/features/auth/AuthActionButton';
import { AuthFeedbackBanner } from './src/features/auth/AuthFeedbackBanner';
import type { AuthFeedback, AuthProviders } from './src/features/auth/types';
import {
  validateForgotPasswordForm,
  validateLoginForm,
  validateRegisterForm,
  validateResetPasswordForm,
  validateVerificationForm
} from './src/features/auth/validation';
import { TalhaoWeatherCard } from './src/features/clima/TalhaoWeatherCard';
import { useTalhaoWeather } from './src/features/clima/useTalhaoWeather';
import { API_BASE_URL } from './src/services/api';
import { TalhaoMapEditor, type TalhaoMapEditorHandle } from './src/features/map/TalhaoMapEditor';
import { TalhoesMap, type TalhoesMapHandle } from './src/features/map/TalhoesMap';
import { OperationalMissionCard } from './src/features/operacoes/OperationalMissionCard';
import {
  calculateAreaInHectares,
  coordinatesToGeoJson,
  geoJsonToCoordinates,
  getTalhaoMapColor
} from './src/features/map/geometry';
import type {
  AppTab,
  AuthScreen,
  Coordinate,
  Propriedade,
  Registro,
  Talhao,
  User
} from './src/features/talhoes/types';



const palette = {
  bg:'#081c15', surface:'#112b21', surface2:'#163528', text:'#f4fff7', soft:'#bfd7c7', accent:'#f4d35e', primary:'#2bb673', danger:'#d9534f'
};

const defaultAuthProviders: AuthProviders = {
  local: {
    enabled: true,
    ready: true
  },
  google: {
    enabled: true,
    ready: false,
    configured: false,
    message: 'A base para login com Google está preparada, mas a configuração OAuth ainda não foi concluída.'
  }
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function Header({title, subtitle, onLogout}:{title:string; subtitle?:string; onLogout?:()=>void}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
      {onLogout && <TouchableOpacity onPress={onLogout} style={styles.secondaryBtnSm}><Text style={styles.secondaryBtnText}>Sair</Text></TouchableOpacity>}
    </View>
  );
}

function TabBar({tab,setTab}:{tab:string; setTab:(t:any)=>void}) {
  const items = [
    ['home','Início'],
    ['talhoes','Áreas'],
    ['diario','Diário'],
    ['historico','Histórico']
  ];
  return (
    <View style={styles.tabBar}>
      {items.map(([key,label])=>(
        <TouchableOpacity key={key} onPress={()=>setTab(key)} style={[styles.tabItem, tab===key && styles.tabItemActive]}>
          <Text style={[styles.tabText, tab===key && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FormError({ message }:{ message:string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

async function api(path:string, options:RequestInit = {}, token?:string) {
  const headers:any = { ...(options.headers||{}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Não foi possível conectar ao backend. Verifique se o servidor está ativo e se a URL da API está correta.');
  }
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new ApiError(json.message || 'A operação falhou. Tente novamente.', res.status);
  return json;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export default function App() {
  const { width } = useWindowDimensions();
  const talhoesMapRef = useRef<TalhoesMapHandle>(null);
  const talhaoEditorMapRef = useRef<TalhaoMapEditorHandle>(null);
  const { getWeatherState, loadWeatherForTalhao } = useTalhaoWeather();

useEffect(() => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'talhaosmart',
  });

  console.log('REDIRECT URI:', redirectUri);
  Alert.alert('Redirect URI', redirectUri);
}, []);

  const [screen, setScreen] = useState<AuthScreen>('login');
  const [tab, setTab] = useState<AppTab>('home');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authPendingAction, setAuthPendingAction] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [authProviders, setAuthProviders] = useState<AuthProviders>(defaultAuthProviders);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [selectedPropriedade, setSelectedPropriedade] = useState<Propriedade | null>(null);
  const [editingPropriedade, setEditingPropriedade] = useState<Propriedade | null>(null);
  const [propriedadeNome, setPropriedadeNome] = useState('');
  const [propriedadeDescricao, setPropriedadeDescricao] = useState('');
  const [propriedadeFormError, setPropriedadeFormError] = useState('');
  const [propriedadeEditorVisible, setPropriedadeEditorVisible] = useState(false);

  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
  const [talhaoNome, setTalhaoNome] = useState('');
  const [talhaoPropriedadeId, setTalhaoPropriedadeId] = useState<number | null>(null);
  const [talhaoFormError, setTalhaoFormError] = useState('');
  const [drawPoints, setDrawPoints] = useState<Coordinate[]>([]);
  const [walking, setWalking] = useState(false);
  const watchRef = useRef<any>(null);
  const [registroDescricao, setRegistroDescricao] = useState('');
  const [registroTalhaoId, setRegistroTalhaoId] = useState<number | null>(null);
  const [audioAsset, setAudioAsset] = useState<any>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const contentWidthStyle = useMemo(() => ({
    width: '100%' as const,
    maxWidth: width >= 1280 ? 1120 : width >= 900 ? 920 : 720,
    alignSelf: 'center' as const
  }), [width]);
  const authShellStyle = useMemo(() => ({
    width: '100%' as const,
    maxWidth: width >= 1024 ? 1040 : 520,
    alignSelf: 'center' as const
  }), [width]);
  const isWideAuthLayout = width >= 920;

  function clearAuthErrorFeedback() {
    setAuthFeedback((current) => current?.type === 'error' ? null : current);
  }

  async function loadAuthProviders() {
    try {
      const providers = await api('/auth/providers');
      setAuthProviders(providers);
    } catch {
      setAuthProviders(defaultAuthProviders);
    }
  }

  function resetAppState() {
    setToken(null);
    setUser(null);
    setPropriedades([]);
    setTalhoes([]);
    setRegistros([]);
    setSelectedPropriedade(null);
    setSelectedTalhao(null);
    setTalhaoNome('');
    setTalhaoPropriedadeId(null);
    setTalhaoFormError('');
    setRegistroTalhaoId(null);
    setRegistroDescricao('');
    setAudioAsset(null);
    setEditorVisible(false);
    setPropriedadeEditorVisible(false);
    setTab('home');
  }

  async function clearSessionAndReturnToLogin(feedback?: AuthFeedback) {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    await stopWalkMode();
    resetAppState();
    setScreen('login');
    if (feedback) setAuthFeedback(feedback);
  }

  async function persistSession(newToken:string, newUser:any) {
    await SecureStore.setItemAsync('token', newToken);
    await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    const loaded = await loadData(newToken, { showAlert: false });
    if (!loaded) return false;
    setAuthFeedback(null);
    setScreen('app');
    setTab('home');
    return true;
  }

  async function loadData(authToken = token || undefined, options?: { showAlert?: boolean }) {
    if (!authToken) return false;
    try {
      const [me, ps, ts, rs] = await Promise.all([
        api('/auth/me', {}, authToken),
        api('/propriedades', {}, authToken),
        api('/talhoes', {}, authToken),
        api('/registros', {}, authToken)
      ]);
      setUser(me);
      setPropriedades(ps);
      setTalhoes(ts);
      setRegistros(rs);
      setSelectedPropriedade((current) => current ? (ps.find((item:Propriedade) => item.id === current.id) || null) : null);
      setSelectedTalhao((current) => current ? (ts.find((item:Talhao) => item.id === current.id) || null) : null);
      setRegistroTalhaoId((current) => current && ts.some((item:Talhao) => item.id === current) ? current : null);
      return true;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await clearSessionAndReturnToLogin({
          type: 'error',
          title: 'Sessão expirada',
          message: 'Seu acesso venceu ou ficou inválido. Faça login novamente para continuar.'
        });
        return false;
      }

      if (options?.showAlert !== false) {
        Alert.alert('Falha ao carregar os dados', getErrorMessage(error, 'Não foi possível atualizar os dados do aplicativo.'));
      }
      return false;
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setAuthInitializing(true);
      await loadAuthProviders();

      const stored = await SecureStore.getItemAsync('token');
      const storedUser = await SecureStore.getItemAsync('user');

      if (stored && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (!mounted) return;
          setToken(stored);
          setUser(parsedUser);
          const loaded = await loadData(stored, { showAlert: false });
          if (loaded && mounted) {
            setScreen('app');
            setTab('home');
          }
        } catch {
          if (mounted) {
            await clearSessionAndReturnToLogin({
              type: 'error',
              title: 'Sessão inválida',
              message: 'Não foi possível restaurar sua sessão anterior. Faça login novamente.'
            });
          }
        }
      }

      if (mounted) setAuthInitializing(false);
    })();

    return () => {
      mounted = false;
      void stopWalkMode();
    };
  }, []);

  async function handleRegister() {
    const validationError = validateRegisterForm(nome, email, senha);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Revise o cadastro', message: validationError });
      return;
    }

    setAuthPendingAction('register');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/register', { method:'POST', body: JSON.stringify({ nome: nome.trim(), email: email.trim(), senha }) });
      setCodigo('');
      setScreen('verify');
      setAuthFeedback({
        type: 'success',
        title: 'Cadastro realizado',
        message: data.message || 'Conta criada com sucesso. Digite o código de 6 dígitos para verificar o email.'
      });
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        title: 'Não foi possível cadastrar',
        message: getErrorMessage(error, 'Revise os dados e tente novamente.')
      });
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function handleVerify() {
    const validationError = validateVerificationForm(email, codigo);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Verificação incompleta', message: validationError });
      return;
    }

    setAuthPendingAction('verify');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/verify-email', { method:'POST', body: JSON.stringify({ email: email.trim(), codigo: codigo.trim() }) });
      await persistSession(data.token, data.user);
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        title: 'Não foi possível verificar o email',
        message: getErrorMessage(error, 'Confira o código informado e tente novamente.')
      });
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function handleResend() {
    const validationError = validateForgotPasswordForm(email);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Email inválido', message: validationError });
      return;
    }

    setAuthPendingAction('resend');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/resend-verification-code', { method:'POST', body: JSON.stringify({ email: email.trim() }) });
      setAuthFeedback({
        type: 'success',
        title: 'Código reenviado',
        message: data.message || 'Um novo código foi gerado. Confira sua caixa de entrada ou o terminal do backend.'
      });
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        title: 'Falha ao reenviar o código',
        message: getErrorMessage(error, 'Não foi possível reenviar o código agora.')
      });
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function handleLogin() {
    const validationError = validateLoginForm(email, senha);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Login incompleto', message: validationError });
      return;
    }

    setAuthPendingAction('login');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/login', { method:'POST', body: JSON.stringify({ email: email.trim(), senha }) });
      await persistSession(data.token, data.user);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível realizar o login.');
      if (message.includes('verificado')) {
        setScreen('verify');
        setAuthFeedback({
          type: 'info',
          title: 'Verifique seu email',
          message: 'Sua conta já existe, mas ainda precisa do código de verificação para liberar o acesso.'
        });
      } else {
        setAuthFeedback({
          type: 'error',
          title: 'Falha no login',
          message
        });
      }
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function handleForgot() {
    const validationError = validateForgotPasswordForm(email);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Email inválido', message: validationError });
      return;
    }

    setAuthPendingAction('forgot');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/forgot-password', { method:'POST', body: JSON.stringify({ email: email.trim() }) });
      setCodigo('');
      setNovaSenha('');
      setScreen('reset');
      setAuthFeedback({
        type: 'success',
        title: 'Código enviado',
        message: data.message || 'Use o código recebido para redefinir a senha.'
      });
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        title: 'Falha na recuperação',
        message: getErrorMessage(error, 'Não foi possível iniciar a recuperação de senha.')
      });
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function handleReset() {
    const validationError = validateResetPasswordForm(email, codigo, novaSenha);
    if (validationError) {
      setAuthFeedback({ type: 'error', title: 'Revise os dados', message: validationError });
      return;
    }

    setAuthPendingAction('reset');
    setAuthFeedback(null);
    try {
      const data = await api('/auth/reset-password', { method:'POST', body: JSON.stringify({ email: email.trim(), codigo: codigo.trim(), novaSenha }) });
      setSenha('');
      setNovaSenha('');
      setCodigo('');
      setScreen('login');
      setAuthFeedback({
        type: 'success',
        title: 'Senha redefinida',
        message: data.message || 'Sua senha foi atualizada com sucesso. Agora faça login novamente.'
      });
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        title: 'Falha ao redefinir a senha',
        message: getErrorMessage(error, 'Não foi possível atualizar a senha agora.')
      });
    } finally {
      setAuthPendingAction(null);
    }
  }

  async function logout() {
    await clearSessionAndReturnToLogin({
      type: 'info',
      title: 'Sessão encerrada',
      message: 'Você saiu com segurança da sua conta.'
    });
  }

  const currentAreaHa = useMemo(() => calculateAreaInHectares(drawPoints), [drawPoints]);

  const filteredTalhoes = useMemo(() => {
    if (!selectedPropriedade) return talhoes;
    return talhoes.filter((talhao) => talhao.propriedade_id === selectedPropriedade.id);
  }, [selectedPropriedade, talhoes]);

  const totalAreaHa = useMemo(() => {
    return talhoes.reduce((sum, talhao) => sum + Number(talhao.area || 0), 0);
  }, [talhoes]);

  const dashboardTalhao = useMemo(() => {
    return selectedTalhao || talhoes[0] || null;
  }, [selectedTalhao, talhoes]);

  const selectedTalhaoWeatherState = getWeatherState(selectedTalhao?.id || null);
  const dashboardWeatherState = getWeatherState(dashboardTalhao?.id || null);

  const activeTalhaoMapColor = useMemo(() => {
    return getTalhaoMapColor(selectedTalhao?.id ?? talhoes.length + 1);
  }, [selectedTalhao?.id, talhoes.length]);

  useEffect(() => {
    if (!selectedTalhao || selectedTalhaoWeatherState.status !== 'idle') return;
    void loadWeatherForTalhao(selectedTalhao);
  }, [selectedTalhao, selectedTalhaoWeatherState.status]);

  useEffect(() => {
    if (!dashboardTalhao || dashboardWeatherState.status !== 'idle') return;
    void loadWeatherForTalhao(dashboardTalhao);
  }, [dashboardTalhao, dashboardWeatherState.status]);

  function selectTalhao(talhao: Talhao) {
    setSelectedTalhao(talhao);
    setSelectedPropriedade(propriedades.find((propriedade) => propriedade.id === talhao.propriedade_id) || null);
    void loadWeatherForTalhao(talhao);
  }

  function openNewPropriedade() {
    setEditingPropriedade(null);
    setPropriedadeNome('');
    setPropriedadeDescricao('');
    setPropriedadeFormError('');
    setPropriedadeEditorVisible(true);
  }

  function openEditPropriedade(propriedade: Propriedade) {
    setEditingPropriedade(propriedade);
    setSelectedPropriedade(propriedade);
    setPropriedadeNome(propriedade.nome);
    setPropriedadeDescricao(propriedade.descricao || '');
    setPropriedadeFormError('');
    setPropriedadeEditorVisible(true);
  }

  function closePropriedadeEditor() {
    setEditingPropriedade(null);
    setPropriedadeFormError('');
    setPropriedadeEditorVisible(false);
  }

  async function savePropriedade() {
    if (!token) return;

    const nomeNormalizado = propriedadeNome.trim();
    const descricaoNormalizada = propriedadeDescricao.trim();

    if (!nomeNormalizado) {
      setPropriedadeFormError('O nome da propriedade é obrigatório.');
      return;
    }

    try {
      const data = editingPropriedade
        ? await api(`/propriedades/${editingPropriedade.id}`, {
            method:'PUT',
            body: JSON.stringify({ nome: nomeNormalizado, descricao: descricaoNormalizada })
          }, token)
        : await api('/propriedades', {
            method:'POST',
            body: JSON.stringify({ nome: nomeNormalizado, descricao: descricaoNormalizada })
          }, token);

      closePropriedadeEditor();
      await loadData(token);
      setSelectedPropriedade(data.propriedade || null);
      Alert.alert(editingPropriedade ? 'Propriedade atualizada' : 'Propriedade criada', data.message || 'A propriedade foi salva com sucesso.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível salvar a propriedade.');
      setPropriedadeFormError(message);
      Alert.alert('Falha ao salvar propriedade', message);
    }
  }

  function confirmRemovePropriedade(propriedade: Propriedade) {
    const totalTalhoes = propriedade.total_talhoes ?? talhoes.filter((talhao) => talhao.propriedade_id === propriedade.id).length;
    const detail = totalTalhoes > 0
      ? `Essa ação também removerá ${totalTalhoes} talhão(ões) vinculado(s) e seus registros.`
      : 'Essa ação removerá apenas a propriedade.';

    Alert.alert(
      'Excluir propriedade',
      `Deseja excluir "${propriedade.nome}"?\n\n${detail}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => { void removePropriedade(propriedade); } }
      ]
    );
  }

  async function removePropriedade(propriedade: Propriedade) {
    if (!token) return;
    try {
      const data = await api(`/propriedades/${propriedade.id}`, { method:'DELETE' }, token);
      await loadData(token);
      setSelectedPropriedade((current) => current?.id === propriedade.id ? null : current);
      setSelectedTalhao((current) => current?.propriedade_id === propriedade.id ? null : current);
      Alert.alert('Propriedade excluída', data.message || 'A propriedade foi removida com sucesso.');
    } catch (error) {
      Alert.alert('Falha ao excluir propriedade', getErrorMessage(error, 'Não foi possível remover a propriedade.'));
    }
  }

  function openNewTalhao() {
    if (!propriedades.length) {
      Alert.alert('Cadastre uma propriedade primeiro', 'Cada talhão precisa estar vinculado a uma propriedade antes de ser salvo.');
      return;
    }
    setSelectedTalhao(null);
    setTalhaoNome('');
    setTalhaoPropriedadeId(selectedPropriedade?.id || propriedades[0].id);
    setTalhaoFormError('');
    setDrawPoints([]);
    setEditorVisible(true);
  }

  function openEditTalhao(t:Talhao) {
    selectTalhao(t);
    setTalhaoNome(t.nome);
    setTalhaoPropriedadeId(t.propriedade_id);
    setTalhaoFormError('');
    setDrawPoints(geoJsonToCoordinates(t.geojson));
    setEditorVisible(true);
  }

  async function saveTalhao() {
    if (!token) return;

    const nomeNormalizado = talhaoNome.trim();
    if (!propriedades.length) {
      setTalhaoFormError('Cadastre uma propriedade antes de salvar talhões.');
      return;
    }
    if (!talhaoPropriedadeId) {
      setTalhaoFormError('Selecione a propriedade à qual este talhão pertence.');
      return;
    }
    if (!nomeNormalizado) {
      setTalhaoFormError('O nome do talhão é obrigatório.');
      return;
    }
    if (drawPoints.length < 3) {
      setTalhaoFormError('Adicione pelo menos 3 pontos para desenhar o polígono do talhão.');
      return;
    }
    const areaCalculada = Number(currentAreaHa.toFixed(2));
    if (!Number.isFinite(areaCalculada) || areaCalculada <= 0) {
      setTalhaoFormError('A área calculada do talhão ficou inválida. Revise o desenho no mapa.');
      return;
    }
    const geojson = coordinatesToGeoJson(drawPoints);
    const body = { nome: nomeNormalizado, area: areaCalculada, geojson, propriedade_id: talhaoPropriedadeId };
    try {
      const data = selectedTalhao
        ? await api(`/talhoes/${selectedTalhao.id}`, { method:'PUT', body: JSON.stringify(body) }, token)
        : await api('/talhoes', { method:'POST', body: JSON.stringify(body) }, token);

      if (selectedTalhao) {
        Alert.alert('Talhão atualizado', data.message || 'O talhão foi atualizado com sucesso.');
      } else {
        Alert.alert('Talhão criado', data.message || 'O talhão foi criado com sucesso.');
      }
      setEditorVisible(false);
      await loadData(token);
      if (data.talhao) {
        setSelectedTalhao(data.talhao);
        setSelectedPropriedade(propriedades.find((propriedade) => propriedade.id === data.talhao.propriedade_id) || null);
        void loadWeatherForTalhao(data.talhao, { force: true });
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível salvar o talhão.');
      setTalhaoFormError(message);
      Alert.alert('Falha ao salvar talhão', message);
    }
  }

  function confirmRemoveTalhao(talhao: Talhao) {
    Alert.alert(
      'Excluir talhão',
      `Deseja excluir "${talhao.nome}" da propriedade "${talhao.propriedade_nome || 'sem nome'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => { void removeTalhao(talhao); } }
      ]
    );
  }

  async function removeTalhao(talhao: Talhao) {
    if (!token) return;
    try {
      const data = await api(`/talhoes/${talhao.id}`, { method:'DELETE' }, token);
      await loadData(token);
      if (selectedTalhao?.id===talhao.id) setSelectedTalhao(null);
      Alert.alert('Talhão excluído', data.message || 'O talhão foi removido com sucesso.');
    } catch (error) { Alert.alert('Falha ao excluir talhão', getErrorMessage(error, 'Não foi possível remover o talhão.')); }
  }

  async function pickAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (!result.canceled) setAudioAsset(result.assets[0]);
    } catch (error) {
      Alert.alert('Falha ao selecionar áudio', getErrorMessage(error, 'Não foi possível anexar o áudio agora.'));
    }
  }

  async function createRegistro() {
    if (!token || !registroTalhaoId) {
      Alert.alert('Selecione um talhão', 'Escolha um talhão antes de salvar o registro.');
      return;
    }
    if (!registroDescricao.trim()) {
      Alert.alert('Descrição obrigatória', 'Escreva uma descrição para o registro de campo.');
      return;
    }
    const form = new FormData();
    form.append('talhao_id', String(registroTalhaoId));
    form.append('descricao', registroDescricao.trim());
    if (audioAsset) {
      form.append('audio', { uri: audioAsset.uri, name: audioAsset.name || 'audio.m4a', type: audioAsset.mimeType || 'audio/m4a' } as any);
    }
    try {
      const data = await api('/registros', { method:'POST', body: form }, token);
      setRegistroDescricao('');
      setRegistroTalhaoId(null);
      setAudioAsset(null);
      setTab('historico');
      await loadData(token);
      Alert.alert('Registro salvo', data.message || 'O registro foi salvo com sucesso.');
    } catch (error) { Alert.alert('Falha ao salvar registro', getErrorMessage(error, 'Não foi possível salvar o registro agora.')); }
  }

  async function addCurrentLocationPoint() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita o acesso à localização para adicionar pontos diretamente do GPS.'); return; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setDrawPoints((prev)=>[...prev, point]);
    if (talhaoFormError) setTalhaoFormError('');
  }

  async function startWalkMode() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita o acesso à localização para usar o modo caminhada.'); return; }
    setWalking(true);
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3,
        timeInterval: 1500,
      },
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setDrawPoints((prev)=>{
          const last = prev[prev.length-1];
          if (!last) return [point];
          const dLat = Math.abs(last.latitude - point.latitude);
          const dLng = Math.abs(last.longitude - point.longitude);
          if (dLat < 0.00001 && dLng < 0.00001) return prev;
          return [...prev, point];
        });
      }
    );
    if (talhaoFormError) setTalhaoFormError('');
  }

  

  async function stopWalkMode() {
    if (watchRef.current) {
      await watchRef.current.remove();
      watchRef.current = null;
    }
    setWalking(false);
  }

  function undoLastPoint() { setDrawPoints(prev=>prev.slice(0,-1)); }
  function clearDrawing() { setDrawPoints([]); }

  const talhoesContent = (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.contentColumn, contentWidthStyle]}>
        <Header title="Propriedades e Talhões" subtitle="Organize as propriedades e vincule cada talhão corretamente" onLogout={logout} />

        <View style={styles.rowWrap}>
          <TouchableOpacity style={styles.primaryBtnCompact} onPress={openNewPropriedade}>
            <Text style={styles.primaryText}>Nova propriedade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtnCompact} onPress={openNewTalhao}>
            <Text style={styles.secondaryBtnText}>Novo talhão</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Propriedades</Text>
          {propriedades.length === 0 ? (
            <Text style={styles.soft}>Nenhuma propriedade cadastrada. Crie a primeira para começar a organizar seus talhões.</Text>
          ) : propriedades.map((propriedade, idx)=>(
            <View key={propriedade.id} style={styles.listItem}>
              <View style={[styles.colorDot, { backgroundColor: ['#f4d35e','#90be6d','#43aa8b','#577590','#f28482'][idx % 5]}]} />
              <View style={{flex:1}}>
                <Text style={styles.itemTitle}>{propriedade.nome}</Text>
                <Text style={styles.soft}>{propriedade.descricao || 'Sem descrição cadastrada.'}</Text>
                <Text style={styles.muted}>{propriedade.total_talhoes ?? 0} talhão(ões)</Text>
              </View>
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.secondaryBtnXs} onPress={()=>openEditPropriedade(propriedade)}>
                  <Text style={styles.secondaryBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtnXs} onPress={()=>confirmRemovePropriedade(propriedade)}>
                  <Text style={styles.dangerBtnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Talhões</Text>
          {propriedades.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.rowWrap}>
                <TouchableOpacity style={[styles.chip, !selectedPropriedade && styles.chipActive]} onPress={()=>setSelectedPropriedade(null)}>
                  <Text style={[styles.chipText, !selectedPropriedade && styles.chipTextActive]}>Todos</Text>
                </TouchableOpacity>
                {propriedades.map((propriedade)=>(
                  <TouchableOpacity
                    key={propriedade.id}
                    style={[styles.chip, selectedPropriedade?.id===propriedade.id && styles.chipActive]}
                    onPress={()=>setSelectedPropriedade(propriedade)}
                  >
                    <Text style={[styles.chipText, selectedPropriedade?.id===propriedade.id && styles.chipTextActive]}>{propriedade.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <TalhoesMap
            ref={talhoesMapRef}
            talhoes={filteredTalhoes}
            selectedTalhaoId={selectedTalhao?.id || null}
            onSelectTalhao={selectTalhao}
            emptyMessage={selectedPropriedade
              ? `Nenhum talhão cadastrado para a propriedade "${selectedPropriedade.nome}".`
              : 'Nenhum talhão cadastrado ainda.'}
          />

          <Text style={styles.soft}>
            {selectedTalhao
              ? `Talhão selecionado: ${selectedTalhao.nome}. Toque no mapa ou na lista para alternar a seleção.`
              : 'Toque em um polígono ou no rótulo do mapa para selecionar um talhão e destacá-lo.'}
          </Text>

          {filteredTalhoes.length === 0 ? (
            <Text style={styles.soft}>
              {selectedPropriedade
                ? `Nenhum talhão cadastrado para a propriedade "${selectedPropriedade.nome}".`
                : 'Nenhum talhão cadastrado ainda.'}
            </Text>
          ) : filteredTalhoes.map((talhao)=>(
            <View key={talhao.id} style={[styles.listItem, selectedTalhao?.id === talhao.id && styles.listItemSelected]}>
              <View style={[styles.colorDot, { backgroundColor: getTalhaoMapColor(talhao.id) }]} />
              <View style={{flex:1}}>
                <Text style={styles.itemTitle}>{talhao.nome}</Text>
                <Text style={styles.soft}>Propriedade: {talhao.propriedade_nome}</Text>
                <Text style={styles.soft}>Área: {Number(talhao.area).toFixed(2)} ha</Text>
              </View>
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.secondaryBtnXs} onPress={()=>selectTalhao(talhao)}>
                  <Text style={styles.secondaryBtnText}>{selectedTalhao?.id === talhao.id ? 'Selecionado' : 'Selecionar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtnXs} onPress={()=>openEditTalhao(talhao)}>
                  <Text style={styles.secondaryBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtnXs} onPress={()=>confirmRemoveTalhao(talhao)}>
                  <Text style={styles.dangerBtnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TalhaoWeatherCard
          title="Clima do talhão"
          subtitle="Clima atual, previsão por hora e alertas simples para o talhão selecionado"
          talhao={selectedTalhao}
          state={selectedTalhaoWeatherState}
          onRetry={() => {
            if (!selectedTalhao) return;
            void loadWeatherForTalhao(selectedTalhao, { force: true });
          }}
        />

        <OperationalMissionCard token={token} selectedTalhao={selectedTalhao} />
      </View>

      <Modal visible={propriedadeEditorVisible} animationType="slide">
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.screen}>
            <View style={[styles.contentColumn, contentWidthStyle]}>
              <Header title={editingPropriedade ? 'Editar propriedade' : 'Nova propriedade'} subtitle="Cadastre a propriedade antes de criar seus talhões" />
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dados da propriedade</Text>
                <FormError message={propriedadeFormError} />
                <TextInput
                  value={propriedadeNome}
                  onChangeText={(value) => {
                    setPropriedadeNome(value);
                    if (propriedadeFormError) setPropriedadeFormError('');
                  }}
                  placeholder="Nome da propriedade"
                  placeholderTextColor="#777"
                  style={styles.input}
                />
                <TextInput
                  value={propriedadeDescricao}
                  onChangeText={setPropriedadeDescricao}
                  multiline
                  placeholder="Descrição da propriedade"
                  placeholderTextColor="#777"
                  style={[styles.input, styles.textArea]}
                />
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={savePropriedade}>
                <Text style={styles.primaryText}>{editingPropriedade ? 'Atualizar' : 'Salvar'} propriedade</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={closePropriedadeEditor}>
                <Text style={styles.secondaryBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={editorVisible} animationType="slide">
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.screen}>
            <View style={[styles.contentColumn, contentWidthStyle]}>
              <Header title={selectedTalhao ? 'Editar talhão' : 'Novo talhão'} subtitle="Selecione a propriedade e desenhe a área no mapa" />
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Vínculo e identificação</Text>
                <FormError message={talhaoFormError} />
                <Text style={styles.sectionLabel}>Propriedade do talhão</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.rowWrap}>
                    {propriedades.map((propriedade)=>(
                      <TouchableOpacity
                        key={propriedade.id}
                        style={[styles.chip, talhaoPropriedadeId===propriedade.id && styles.chipActive]}
                        onPress={()=>{
                          setTalhaoPropriedadeId(propriedade.id);
                          if (talhaoFormError) setTalhaoFormError('');
                        }}
                      >
                        <Text style={[styles.chipText, talhaoPropriedadeId===propriedade.id && styles.chipTextActive]}>{propriedade.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  value={talhaoNome}
                  onChangeText={(value)=>{
                    setTalhaoNome(value);
                    if (talhaoFormError) setTalhaoFormError('');
                  }}
                  placeholder="Nome do talhão"
                  placeholderTextColor="#777"
                  style={styles.input}
                />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mapa</Text>
                <TalhaoMapEditor
                  ref={talhaoEditorMapRef}
                  points={drawPoints}
                  onChangePoints={(nextPoints) => {
                    setDrawPoints(nextPoints);
                    if (talhaoFormError) setTalhaoFormError('');
                  }}
                  polygonColor={activeTalhaoMapColor}
                />
                <Text style={[styles.soft, { marginTop:10 }]}>Pontos: {drawPoints.length} • Área estimada: {currentAreaHa.toFixed(2)} ha</Text>
                <Text style={[styles.soft, { marginTop:6 }]}>Modo caminhada usa GPS do celular. A precisão real depende do sinal, ambiente e hardware.</Text>
                <View style={styles.rowWrap}>
                  <TouchableOpacity style={styles.secondaryBtnSm} onPress={addCurrentLocationPoint}><Text style={styles.secondaryBtnText}>Usar GPS atual</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtnSm} onPress={()=>talhaoEditorMapRef.current?.fitToDrawing()}><Text style={styles.secondaryBtnText}>Centralizar desenho</Text></TouchableOpacity>
                  {!walking ? (
                    <TouchableOpacity style={styles.secondaryBtnSm} onPress={startWalkMode}><Text style={styles.secondaryBtnText}>Iniciar caminhada</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.secondaryBtnSm} onPress={stopWalkMode}><Text style={styles.secondaryBtnText}>Parar caminhada</Text></TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.secondaryBtnSm} onPress={undoLastPoint}><Text style={styles.secondaryBtnText}>Desfazer</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtnSm} onPress={clearDrawing}><Text style={styles.secondaryBtnText}>Limpar</Text></TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveTalhao}><Text style={styles.primaryText}>{selectedTalhao ? 'Atualizar' : 'Salvar'} talhão</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={()=>{ void stopWalkMode(); setEditorVisible(false); setTalhaoFormError(''); }}><Text style={styles.secondaryBtnText}>Fechar</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );

  const diarioContent = (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.contentColumn, contentWidthStyle]}>
        <Header title="Diário de Campo" subtitle="Registre atividades vinculadas aos seus talhões" onLogout={logout} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novo registro</Text>
          {talhoes.length === 0 ? (
            <Text style={styles.soft}>Crie pelo menos uma propriedade com um talhão antes de registrar atividades de campo.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={styles.rowWrap}>
                  {talhoes.map(t=>(
                    <TouchableOpacity key={t.id} style={[styles.chip, registroTalhaoId===t.id && styles.chipActive]} onPress={()=>setRegistroTalhaoId(t.id)}>
                      <Text style={[styles.chipText, registroTalhaoId===t.id && styles.chipTextActive]}>
                        {t.propriedade_nome ? `${t.propriedade_nome} • ${t.nome}` : t.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TextInput
                value={registroDescricao}
                onChangeText={setRegistroDescricao}
                multiline
                placeholder="Descreva a atividade realizada no campo"
                placeholderTextColor="#777"
                style={[styles.input, styles.textArea]}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={pickAudio}>
                <Text style={styles.secondaryBtnText}>{audioAsset ? `Áudio selecionado: ${audioAsset.name}` : 'Selecionar áudio'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={createRegistro}><Text style={styles.primaryText}>Salvar registro</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const historicoContent = (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.contentColumn, contentWidthStyle]}>
        <Header title="Histórico" subtitle="Consulte registros por propriedade e talhão" onLogout={logout} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registros</Text>
          {registros.length === 0 ? <Text style={styles.soft}>Nenhum registro ainda.</Text> : registros.map(r=>(
            <View key={r.id} style={styles.timelineItem}>
              <Text style={styles.itemTitle}>
                {r.propriedade_nome
                  ? `${r.propriedade_nome} • ${r.talhao_nome || `Talhão #${r.talhao_id}`}`
                  : r.talhao_nome || `Talhão #${r.talhao_id}`}
              </Text>
              <Text style={styles.soft}>{r.descricao}</Text>
              <Text style={styles.muted}>{new Date(r.created_at).toLocaleString('pt-BR')}</Text>
              {r.audio_url ? <Text style={styles.accentSmall}>Áudio anexado</Text> : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const homeContent = (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.contentColumn, contentWidthStyle]}>
        <Header title={`Olá, ${user?.nome || ''}!`} subtitle="Acompanhe o andamento da sua operação no TalhãoSmart" onLogout={logout} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.bigAccent}>{propriedades.length}</Text>
              <Text style={styles.soft}>propriedade(s)</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.bigAccent}>{talhoes.length}</Text>
              <Text style={styles.soft}>talhão(ões)</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.bigAccent}>{registros.length}</Text>
              <Text style={styles.soft}>registro(s)</Text>
            </View>
          </View>
          <Text style={styles.soft}>Área total cadastrada: {totalAreaHa.toFixed(2)} ha</Text>
        </View>
        <TalhaoWeatherCard
          title="Clima no dashboard"
          subtitle="Talhão em destaque para acompanhamento rápido da operação"
          talhao={dashboardTalhao}
          state={dashboardWeatherState}
          onRetry={() => {
            if (!dashboardTalhao) return;
            void loadWeatherForTalhao(dashboardTalhao, { force: true });
          }}
        />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Atalhos</Text>
          <View style={styles.rowWrap}>
            <TouchableOpacity style={styles.secondaryBtnSm} onPress={()=>{ setTab('talhoes'); openNewPropriedade(); }}><Text style={styles.secondaryBtnText}>Nova propriedade</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtnSm} onPress={()=>{ setTab('talhoes'); openNewTalhao(); }}><Text style={styles.secondaryBtnText}>Novo talhão</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtnSm} onPress={()=>setTab('diario')}><Text style={styles.secondaryBtnText}>Novo registro</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtnSm} onPress={()=>{ void loadData(); }}><Text style={styles.secondaryBtnText}>Atualizar dados</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  if (authInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingTitle}>Validando sua sessão</Text>
          <Text style={styles.soft}>Carregando autenticação, permissões e dados privados do TalhãoSmart.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen !== 'app' || !token || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.authScreen}>
          <View style={[styles.authShell, authShellStyle, isWideAuthLayout && styles.authShellWide]}>
            <View style={[styles.card, styles.authIntroCard, isWideAuthLayout && styles.authPanelWide]}>
              <Text style={[styles.cardTitle, styles.authBrandTitle]}>TalhãoSmart</Text>
              <Text style={styles.soft}>Autenticação com cadastro validado, login protegido e verificação por código.</Text>
              <View style={styles.authHighlight}>
                <Text style={styles.authHighlightTitle}>Acesso privado protegido</Text>
                <Text style={styles.soft}>As rotas privadas continuam protegidas no backend e o app encerra automaticamente sessões inválidas.</Text>
              </View>
              <View style={styles.authHighlight}>
                <Text style={styles.authHighlightTitle}>Google preparado para a próxima fase</Text>
                <Text style={styles.soft}>{authProviders.google.message || defaultAuthProviders.google.message}</Text>
                <AuthActionButton
                  label={authProviders.google.configured ? 'Google em preparação' : 'Google ainda não configurado'}
                  onPress={() => {}}
                  disabled
                  variant="secondary"
                />
              </View>
            </View>

            <View style={[styles.card, styles.authFormCard, isWideAuthLayout && styles.authPanelWide]}>
              <AuthFeedbackBanner feedback={authFeedback} />

              {screen === 'login' && <>
                <Text style={styles.cardTitle}>Entrar</Text>
                <TextInput value={email} onChangeText={(value)=>{ setEmail(value); clearAuthErrorFeedback(); }} placeholder="Email" placeholderTextColor="#777" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                <TextInput value={senha} onChangeText={(value)=>{ setSenha(value); clearAuthErrorFeedback(); }} placeholder="Senha" placeholderTextColor="#777" style={styles.input} secureTextEntry />
                <AuthActionButton label="Entrar" onPress={()=>{ void handleLogin(); }} loading={authPendingAction==='login'} />
                <AuthActionButton label="Criar conta" onPress={()=>{ setAuthFeedback(null); setScreen('register'); }} variant="secondary" />
                <AuthActionButton label="Esqueci minha senha" onPress={()=>{ setAuthFeedback(null); setScreen('forgot'); }} variant="secondary" />
              </>}

              {screen === 'register' && <>
                <Text style={styles.cardTitle}>Cadastro</Text>
                <TextInput value={nome} onChangeText={(value)=>{ setNome(value); clearAuthErrorFeedback(); }} placeholder="Nome completo" placeholderTextColor="#777" style={styles.input} />
                <TextInput value={email} onChangeText={(value)=>{ setEmail(value); clearAuthErrorFeedback(); }} placeholder="Email" placeholderTextColor="#777" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                <TextInput value={senha} onChangeText={(value)=>{ setSenha(value); clearAuthErrorFeedback(); }} placeholder="Senha com pelo menos 6 caracteres" placeholderTextColor="#777" style={styles.input} secureTextEntry />
                <AuthActionButton label="Cadastrar" onPress={()=>{ void handleRegister(); }} loading={authPendingAction==='register'} />
                <AuthActionButton label="Voltar para login" onPress={()=>{ setAuthFeedback(null); setScreen('login'); }} variant="secondary" />
              </>}

              {screen === 'verify' && <>
                <Text style={styles.cardTitle}>Verificar email</Text>
                <Text style={styles.soft}>Digite o código de 6 dígitos enviado para liberar o acesso.</Text>
                <TextInput value={email} onChangeText={(value)=>{ setEmail(value); clearAuthErrorFeedback(); }} placeholder="Email" placeholderTextColor="#777" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                <TextInput value={codigo} onChangeText={(value)=>{ setCodigo(value); clearAuthErrorFeedback(); }} placeholder="Código de verificação" placeholderTextColor="#777" style={styles.input} keyboardType="number-pad" />
                <AuthActionButton label="Verificar" onPress={()=>{ void handleVerify(); }} loading={authPendingAction==='verify'} />
                <AuthActionButton label="Reenviar código" onPress={()=>{ void handleResend(); }} loading={authPendingAction==='resend'} variant="secondary" />
                <AuthActionButton label="Voltar para login" onPress={()=>{ setAuthFeedback(null); setScreen('login'); }} variant="secondary" />
              </>}

              {screen === 'forgot' && <>
                <Text style={styles.cardTitle}>Recuperar senha</Text>
                <Text style={styles.soft}>Informe o email da conta para gerar um novo código de recuperação.</Text>
                <TextInput value={email} onChangeText={(value)=>{ setEmail(value); clearAuthErrorFeedback(); }} placeholder="Email" placeholderTextColor="#777" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                <AuthActionButton label="Enviar código" onPress={()=>{ void handleForgot(); }} loading={authPendingAction==='forgot'} />
                <AuthActionButton label="Voltar para login" onPress={()=>{ setAuthFeedback(null); setScreen('login'); }} variant="secondary" />
              </>}

              {screen === 'reset' && <>
                <Text style={styles.cardTitle}>Redefinir senha</Text>
                <Text style={styles.soft}>Use o código recebido e defina uma nova senha para retomar o acesso.</Text>
                <TextInput value={email} onChangeText={(value)=>{ setEmail(value); clearAuthErrorFeedback(); }} placeholder="Email" placeholderTextColor="#777" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                <TextInput value={codigo} onChangeText={(value)=>{ setCodigo(value); clearAuthErrorFeedback(); }} placeholder="Código de recuperação" placeholderTextColor="#777" style={styles.input} keyboardType="number-pad" />
                <TextInput value={novaSenha} onChangeText={(value)=>{ setNovaSenha(value); clearAuthErrorFeedback(); }} placeholder="Nova senha" placeholderTextColor="#777" style={styles.input} secureTextEntry />
                <AuthActionButton label="Redefinir senha" onPress={()=>{ void handleReset(); }} loading={authPendingAction==='reset'} />
                <AuthActionButton label="Voltar para login" onPress={()=>{ setAuthFeedback(null); setScreen('login'); }} variant="secondary" />
              </>}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {tab === 'home' && homeContent}
      {tab === 'talhoes' && talhoesContent}
      {tab === 'diario' && diarioContent}
      {tab === 'historico' && historicoContent}
      <TabBar tab={tab} setTab={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{ flex:1, backgroundColor: palette.bg },
  screen:{ padding:16, gap:16, paddingBottom:110 },
  contentColumn:{ width:'100%', gap:16, alignSelf:'center' },
  authScreen:{ flexGrow:1, padding:16, justifyContent:'center' },
  authShell:{ width:'100%', gap:16, alignSelf:'center' },
  authShellWide:{ flexDirection:'row', alignItems:'stretch' },
  authIntroCard:{ justifyContent:'space-between' },
  authFormCard:{ flexGrow:1 },
  authPanelWide:{ flex:1 },
  authBrandTitle:{ fontSize:30, color:palette.accent },
  authHighlight:{ backgroundColor:'rgba(255,255,255,0.04)', borderRadius:14, padding:14, gap:8 },
  authHighlightTitle:{ color:palette.text, fontWeight:'700', fontSize:16 },
  loadingScreen:{ flex:1, alignItems:'center', justifyContent:'center', padding:24, gap:12 },
  loadingTitle:{ color:palette.text, fontSize:24, fontWeight:'800' },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4, gap:12 },
  headerTitle:{ color:palette.text, fontSize:28, fontWeight:'800' },
  headerSub:{ color:palette.soft, marginTop:4 },
  card:{ backgroundColor:palette.surface, borderRadius:18, padding:16, gap:12 },
  cardTitle:{ color:palette.text, fontSize:20, fontWeight:'700' },
  sectionLabel:{ color:palette.soft, fontWeight:'700' },
  input:{ backgroundColor:'#f7fff9', borderRadius:12, padding:14, color:'#173025' },
  textArea:{ minHeight:120, textAlignVertical:'top' },
  primaryBtn:{ backgroundColor:palette.accent, borderRadius:12, padding:14, alignItems:'center', justifyContent:'center', marginTop:4 },
  primaryBtnCompact:{ backgroundColor:palette.accent, borderRadius:12, paddingVertical:14, paddingHorizontal:16, alignItems:'center', justifyContent:'center', flex:1 },
  primaryText:{ color:'#173025', fontWeight:'800' },
  secondaryBtn:{ backgroundColor:palette.surface2, borderRadius:12, padding:14, alignItems:'center', justifyContent:'center', marginTop:4 },
  secondaryBtnSm:{ backgroundColor:palette.surface2, borderRadius:12, paddingVertical:10, paddingHorizontal:12, alignItems:'center', justifyContent:'center' },
  secondaryBtnCompact:{ backgroundColor:palette.surface2, borderRadius:12, paddingVertical:14, paddingHorizontal:16, alignItems:'center', justifyContent:'center', flex:1 },
  secondaryBtnXs:{ backgroundColor:palette.surface2, borderRadius:10, paddingVertical:8, paddingHorizontal:10, alignItems:'center', justifyContent:'center' },
  secondaryBtnText:{ color:palette.text, fontWeight:'700' },
  dangerBtnXs:{ backgroundColor:'rgba(217,83,79,0.16)', borderRadius:10, paddingVertical:8, paddingHorizontal:10, alignItems:'center', justifyContent:'center' },
  dangerBtnText:{ color:'#ffd6d4', fontWeight:'700' },
  soft:{ color:palette.soft, lineHeight:20 },
  muted:{ color:'#8fb09a', fontSize:12 },
  bigAccent:{ color:palette.accent, fontSize:34, fontWeight:'900' },
  accentSmall:{ color:palette.accent, fontWeight:'700', marginTop:6 },
  errorBanner:{ backgroundColor:'rgba(217,83,79,0.18)', borderRadius:12, padding:12 },
  errorBannerText:{ color:'#ffd6d4', fontWeight:'600' },
  tabBar:{ position:'absolute', left:0, right:0, bottom:0, padding:12, paddingBottom:18, backgroundColor:'rgba(8,28,21,0.98)', flexDirection:'row', gap:10, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  tabItem:{ flex:1, paddingVertical:12, borderRadius:14, backgroundColor:palette.surface2, alignItems:'center' },
  tabItemActive:{ backgroundColor:palette.accent },
  tabText:{ color:palette.text, fontWeight:'700', fontSize:12 },
  tabTextActive:{ color:'#173025' },
  listItem:{ flexDirection:'row', alignItems:'flex-start', gap:12, backgroundColor:'rgba(255,255,255,0.04)', padding:12, borderRadius:14 },
  listItemSelected:{ borderWidth:1, borderColor:'rgba(244,211,94,0.55)', backgroundColor:'rgba(244,211,94,0.08)' },
  itemTitle:{ color:palette.text, fontWeight:'700', fontSize:16 },
  colorDot:{ width:16, height:16, borderRadius:8, marginTop:4 },
  actionGroup:{ gap:8 },
  rowWrap:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:{ paddingVertical:10, paddingHorizontal:14, backgroundColor:palette.surface2, borderRadius:999 },
  chipActive:{ backgroundColor:palette.accent },
  chipText:{ color:palette.text, fontWeight:'700' },
  chipTextActive:{ color:'#173025' },
  timelineItem:{ backgroundColor:'rgba(255,255,255,0.04)', padding:14, borderRadius:14, gap:6 },
  map:{ width:'100%', height:320, borderRadius:16 },
  statsGrid:{ flexDirection:'row', flexWrap:'wrap', gap:12 },
  statCard:{ flexBasis:'30%', flexGrow:1, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:14, padding:14, gap:4 }
});
