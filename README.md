# node_js_app

API de estudo para cadastro e autenticação de usuários, feita com Node.js, Express, TypeScript e MongoDB.

## Requisitos

- Node.js 22 ou 24 e npm 9 ou superior para desenvolvimento local;
- Docker com Docker Compose v2 para iniciar a aplicação e o MongoDB;
- `make` para usar os comandos curtos documentados abaixo.

## Início rápido com Docker

Na primeira execução, gere credenciais locais e inicie os serviços:

```bash
make init
make up
```

O comando cria `.env` com usuário, senha e chave JWT aleatórios, protege o arquivo com permissões `0600` e não o adiciona ao Git. A API fica em `http://127.0.0.1:3210`; o MongoDB fica acessível apenas pelo próprio computador em `127.0.0.1:27018`.

Comandos disponíveis:

```bash
make logs
make down
```

## Desenvolvimento local

Com o MongoDB do Compose ligado, instale as dependências e inicie o servidor TypeScript:

```bash
make init
make up
npm ci
npm run dev
```

O servidor local usa `HOST` e `SERVER_PORT` do `.env` (padrões `127.0.0.1` e `3000`) e conecta ao Mongo publicado em `127.0.0.1:27018`. Para compilar e executar a versão de produção:

```bash
npm run build
npm start
```

`npm run lint` verifica o código. O projeto ainda não tem arquivos de teste versionados nem script de teste.

## API

### Criar uma conta

`POST /users` é público. A senha deve ter entre 12 e 1024 bytes; o e-mail é normalizado para minúsculas.

```bash
curl http://127.0.0.1:3210/users \
  -H 'content-type: application/json' \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"uma-senha-longa-e-unica"}'
```

O retorno é `201 Created` e inclui apenas id, nome, e-mail e data de criação. A senha nunca aparece na resposta. E-mail já cadastrado retorna `409`; dados inválidos retornam `400`.

### Entrar

`POST /sessions` recebe e-mail e senha e retorna um token Bearer válido por uma hora. Erros de login usam a mesma mensagem para e-mail inexistente e senha incorreta.

```bash
curl http://127.0.0.1:3210/sessions \
  -H 'content-type: application/json' \
  -d '{"email":"ana@example.com","password":"uma-senha-longa-e-unica"}'
```

### Consultar o próprio perfil

`GET /users/me` exige o token recebido no login:

```bash
curl http://127.0.0.1:3210/users/me \
  -H 'authorization: Bearer SEU_TOKEN'
```

Tokens expirados, inválidos ou ausentes retornam `401 Unauthorized`. O endpoint só retorna os dados do usuário autenticado.

### Saúde do serviço

`GET /health` retorna `200` quando a API está conectada ao MongoDB e `503` quando está desconectada. O Compose usa esse estado para aguardar o banco antes de iniciar a API.

## Segurança e configuração

- As senhas novas usam bcrypt com custo 12, sobre um digest SHA-256 de tamanho fixo para evitar truncamento do bcrypt. Hashes MD5 legados são migrados na primeira autenticação bem-sucedida.
- `JWT_SECRET` precisa ter pelo menos 32 bytes. `make init` gera uma chave aleatória; trocá-la invalida os tokens emitidos anteriormente.
- Cadastro é limitado a 10 tentativas por IP a cada 15 minutos e login a 5. O contador padrão fica na memória do processo; uma instalação com várias réplicas deve configurar um store compartilhado.
- O Compose vincula as portas ao loopback e guarda os dados do banco no volume `mongo_data`.
- O Compose usa MongoDB 8.0.34. Não monte diretamente no Mongo novo um diretório de dados criado por MongoDB 4.2. Antes de reaproveitar dados antigos, faça backup e siga uma rota de atualização compatível com as versões intermediárias do MongoDB.
- `MONGO_URI` é opcional para conectar a um banco externo. Sem ela, o servidor monta a URI usando `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT` e `DB_NAME`.

## Estrutura

```text
src/
├── @types/express/       # tipo do id autenticado no Request
├── config.ts             # validação de variáveis de ambiente
├── controllers/          # cadastro, login e perfil
├── database/             # conexão com MongoDB
├── errors/               # erros HTTP da aplicação
├── middlewares/           # autenticação Bearer
├── models/               # modelo User e hash de senha
├── routes.ts             # rotas e limites de requisição
├── services/             # cadastro e autenticação
└── utils/                # normalização segura para bcrypt
```

## Licença

MIT — consulte [LICENSE](LICENSE).
