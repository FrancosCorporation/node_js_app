# node_js_app

API REST de estudo em **Node.js + Express + MongoDB** para cadastro de usuários, com MongoDB pronto para subir via Docker Compose.

![TypeScript](https://img.shields.io/badge/TypeScript-4-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat&logo=mongodb&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)
![Status](https://img.shields.io/badge/status-projeto%20de%20estudo-blue)

## Sobre

Projeto de estudo que monta o esqueleto de uma API de usuários: conexão com MongoDB via Mongoose, model com validação, controller e service, além de infraestrutura local de banco com Docker Compose e Makefile. O objetivo foi praticar a organização em camadas e o uso de variáveis de ambiente em um servidor Express com TypeScript.

## Funcionalidades

Comprovadas pelo código:

- `POST /users` — cria usuário com `name`, `email` e `password` (`src/routes.ts`, `src/controllers/CreateUsersController.ts`);
- Model `User` (Mongoose) com e-mail único em minúsculas, senha oculta por padrão (`select: false`) e hash automático no `set` do schema (`src/models/User.ts`);
- Conexão com MongoDB montada a partir de variáveis de ambiente e log de erro/conexão (`src/database/index.ts`);
- Middleware centralizado de erros respondendo JSON (`src/server.ts`);
- Infra local: `docker-compose.yml` sobe um `mongo:4.2` usando as variáveis do `.env`, e o `Makefile` encapsula `up`, `down` e `logs`.

## Stack

- **Node.js + Express 4** com **TypeScript**
- **MongoDB 4.2** via **Mongoose 5**
- **Docker Compose** e **Makefile** para o banco local
- **dotenv** para configuração
- **ESLint + Prettier**; **Jest + ts-jest** configurados

Observação de honestidade: `restify` e `typeorm` constam no `package.json`, mas **não são usados** no código em `src/` (herança de experimentos anteriores).

## Como rodar

Requer configuração de ambiente. O `Makefile` faz `include .env` e o `docker-compose.yml` usa as variáveis abaixo — crie um `.env` na raiz (há um [`.env.example`](.env.example) como modelo):

```env
DB_USER=usuario
DB_PASS=senha
DB_HOST=localhost
DB_PORT=27017
DB_NAME=node_js_app
SERVER_PORT=3333
```

```bash
yarn install      # ou npm install

make up           # sobe o MongoDB em background (docker-compose up -d)
make logs         # acompanha os logs do banco (opcional)

yarn dev          # API em http://localhost:$SERVER_PORT (ts-node-dev)
```

Outros scripts do `package.json`:

```bash
yarn dev1   # variante com nodemon + dotenv
yarn start  # executa dist/server.js (requer build prévio)
yarn test   # jest — não há arquivos de teste versionados
```

## Estrutura do projeto

```
.
├── docker-compose.yml    # MongoDB local
├── Makefile              # atalhos para o docker-compose
├── jest.config.js
├── babel.config.js
├── .eslintrc.json
└── src/
    ├── controllers/      # CreateUsersController
    ├── database/         # conexão Mongoose
    ├── models/           # schema User
    ├── services/         # CreateUserService
    ├── routes.ts
    └── server.ts
```

## Observações

- O hash de senha é feito com **MD5** (`crypto.createHash('md5')`) no schema — funciona para o exercício, mas não é o algoritmo adequado para projetos reais.
- Não há autenticação/autorização nem testes implementados; o foco do estudo foi a base da API e a infraestrutura local.

## Licença

MIT — veja [LICENSE](LICENSE).
