# TalhãoSmart Autônomo

Projeto autônomo com:
- `backend/` em Node + TypeScript + SQLite local
- `mobile/` em Expo + TypeScript

## O que já vem funcionando
- cadastro
- verificação de email por código (código aparece no terminal do backend)
- login
- recuperação de senha por código (código aparece no terminal do backend)
- tela home
- CRUD de talhões
- edição real de talhão
- desenho manual tocando no mapa
- modo caminhada usando GPS
- cálculo de área em hectares
- diário de campo
- upload de áudio
- histórico de registros

## Observação sobre precisão
O modo caminhada usa GPS do smartphone.
Isso ajuda bastante em campo, mas não existe garantia honesta de 100% de precisão com GPS comum de celular.
A precisão depende de:
- qualidade do sinal
- céu aberto
- interferência
- modelo do aparelho
- velocidade de deslocamento

## Setup local

### Backend
O backend usa SQLite local e não precisa de Postgres.

1. Entre em `backend/`
2. Se precisar recriar a configuração, copie `.env.example` para `.env`
3. Instale as dependências com `npm install`
4. Valide o projeto:
```bash
npm run build
npm run lint
npm test
```
5. Suba o backend quando quiser usar o app:
```bash
npm run dev
```

Variáveis usadas no backend:
- `PORT`: porta HTTP, padrão `3000`
- `DATABASE_PATH`: caminho do arquivo SQLite, padrão `./talhaosmart.sqlite`
- `JWT_SECRET`: segredo do token JWT
- `CORS_ORIGIN`: origem permitida no CORS, padrão `*`

### Mobile
O app mobile lê a URL da API via `EXPO_PUBLIC_API_BASE_URL`.

1. Entre em `mobile/`
2. Instale as dependências com `npm install`
3. Opcionalmente copie `.env.example` para `.env`
4. Ajuste `EXPO_PUBLIC_API_BASE_URL` quando for usar aparelho físico
5. Valide o projeto:
```bash
npm run build
npm run lint
```
6. Inicie o Expo:
```bash
npm start
```

Padrões usados pelo mobile quando a variável não estiver definida:
- Android Emulator: `http://10.0.2.2:3000/api/v1`
- iOS Simulator e ambiente local no computador: `http://127.0.0.1:3000/api/v1`

Para aparelho físico, use o IP da sua máquina na rede local, por exemplo:
`http://192.168.0.15:3000/api/v1`

## Como testar localmente

1. Rode `npm test` dentro de `backend/` para validar banco SQLite, autenticação, CRUD de talhões e registros.
2. Com o backend ativo em `http://localhost:3000`, rode `npm start` dentro de `mobile/`.
3. Abra no Android Emulator, iOS Simulator ou Expo Go.

## Observações
- o código de verificação de email e o código de reset continuam sendo exibidos no terminal do backend
- o diretório `backend/uploads/` é criado automaticamente
- o arquivo SQLite local fica em `backend/talhaosmart.sqlite`, salvo se `DATABASE_PATH` for alterado
