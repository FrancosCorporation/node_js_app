# MELHORIAS — node_js_app

> **Atualizado em 2026-10-12.** O diagnóstico detalhado das seções seguintes foi escrito em 2026-10-05 e está mantido como histórico. O resumo abaixo registra o estado atual após a implementação.

## Resultado da implementação

- Corrigida a URI do Mongo: `MONGO_URI` continua opcional; sem ela, a aplicação monta a conexão com credenciais escapadas por URL.
- Adicionado carregamento e validação de ambiente no início do processo. `make init` gera `.env` aleatório com modo `0600` e mantém um arquivo já existente.
- Substituído MD5 por bcrypt com custo 12 sobre digest SHA-256 de tamanho fixo. Hashes MD5 existentes são comparados em tempo constante e atualizados no primeiro login válido.
- Implementados `POST /sessions` com JWT HS256 por uma hora e `GET /users/me` protegido. Cadastro continua público, com limite por IP.
- Cadastro valida nome, e-mail e senha; erros de dados, e-mail duplicado, JSON inválido e falhas inesperadas recebem status e mensagens adequados.
- Respostas de cadastro, login e perfil não incluem o hash da senha. Adicionados Helmet, limite de JSON, endpoint de saúde e encerramento gracioso.
- Atualizados Node do container para 24, Express para 5, Mongoose para 9 e MongoDB para 8.0.34; credenciais geradas por instalação e portas vinculadas ao loopback.
- Adicionados healthchecks e dependência condicionada à saúde do banco; removidas dependências não usadas e configurações Babel/Jest sem testes, e reparado o lint com ESLint atual.
- Adicionada CI estática para Node 22/24 com lint, build, auditoria npm e validação da configuração Compose; o workflow não executa testes nem sobe serviços.
- O README foi refeito para descrever o setup, rotas, limites e cautela de migração do banco.

Verificações executadas: `npm run build`, `npm run lint`, `npm audit --audit-level=low`, `docker compose config --quiet` e `git diff --check`. A auditoria encontrou zero vulnerabilidades. CI `38197790021` passou em Node 22/24 nos mesmos checks estáticos. Nenhum teste foi adicionado ou executado. Os containers não foram iniciados neste ambiente.

Limitações restantes: ainda não há suíte de testes; rate limits usam memória local e não compartilham contadores entre réplicas; não há fluxo de recuperação de senha nem revogação imediata de tokens antes do vencimento.

As seções abaixo são a análise e proposta originais, anteriores às mudanças, e servem apenas como histórico de planejamento.

## 0. Como usar este documento

- Cada item tem exatamente 6 campos: **Arquivo:** (caminho absoluto:linha, lido na fonte), **Evidência:** (o que o código mostra), **Impacto:** (consequência prática), **Mudança:** (o que fazer), **Aceite:** (condição objetiva de fim) e **Verificação:** (comando `bash` reproduzível).
- Prioridades: **[P0]** = bloqueia uso correto/seguro agora; **[P1]** = primeira onda; **[P2]** = segunda onda; **[P3]** = quando der.
- Prefixos: `SEC` segurança · `BUG` defeito funcional · `TEST` testes · `IMP` dívida de código/ferramentas · `DEVOPS` infra · `DOC` documentação.
- Todos os itens derivam de leitura direta dos arquivos (e, quando indicado, de comando executado neste checkout — `node_modules` não está instalado aqui). Nenhum arquivo:linha foi presumido.
- Ordem de ataque: seção 8 (waves). Critério de encerramento: seção 10 (DoD).

## 1. Diagnóstico executivo

API pequena e organizada (6 arquivos em `src/`, camadas controller/service/model/routes), com Docker, Makefile e lint acima da média do acervo — porém **a suíte de testes não sobe** (`jest.config.js` lê `tsconfig.json` que contém comentários), **a senha é hasheada com MD5**, **não existe nenhuma autenticação** e **a URI do Mongo montada no compose não leva credenciais** enquanto o banco sobe com root/root. O README classifica o projeto como de estudo (`README.md:12`), mas os itens P0 valem para qualquer uso real.

### O que está bem

| Item | Evidência |
|---|---|
| Docker multi-stage com Node 20 e produção sem devDeps | `/home/servidor/Git/node_js_app/Dockerfile:1` (`node:20-alpine AS build`), `:8` (segundo estágio), `:13` (`npm ci --omit=dev`), `:15` (`node dist/server.js`) |
| docker-compose com app + banco, restart e portas | `/home/servidor/Git/node_js_app/docker-compose.yml:1-28` (`app` + `db`, `restart: unless-stopped` em `:5`) |
| `.env.example` documentado com comentários | `/home/servidor/Git/node_js_app/.env.example:1-10` |
| Makefile com alvos `up`/`down`/`logs` | `/home/servidor/Git/node_js_app/Makefile:3-16` |
| Jest configurado com `ts-jest`, `clearMocks` e `testEnvironment: node` | `/home/servidor/Git/node_js_app/jest.config.js:15`, `:91` (`preset: 'ts-jest'`), `:132` |
| ESLint + Prettier + plugins TypeScript no `devDependencies` | `/home/servidor/Git/node_js_app/package.json:16-27`; `.eslintrc.json` e `.eslintignore` presentes |
| Senha nunca volta na query (`select: false`) e tem hash automático no `set` (não é texto puro) | `/home/servidor/Git/node_js_app/src/models/User.ts:22`, `:23-27` |
| E-mail com `unique`, `lowercase`, `trim`; `timestamps` no schema | `/home/servidor/Git/node_js_app/src/models/User.ts:11-17`, `:31` |
| Middleware central de erros + `express-async-errors` | `/home/servidor/Git/node_js_app/src/server.ts:3`, `:11-20` |
| Separação em camadas e rota tipada | `/home/servidor/Git/node_js_app/src/routes.ts:5-7`, `src/controllers/CreateUsersController.ts:6-10`, `src/services/CreateUserService.ts:14-18` |
| `.env` no `.gitignore` (não vaza segredo) | `/home/servidor/Git/node_js_app/.gitignore:3` |

### O que está quebrado

| Item | Evidência |
|---|---|
| `npm test` aborta na leitura da config | `jest.config.js:1-2` faz `require('./tsconfig.json')` e `tsconfig.json:3` tem comentários JSONC → `SyntaxError` (executado neste checkout) |
| Senha hasheada com MD5 sem salt | `/home/servidor/Git/node_js_app/src/models/User.ts:23-27` |
| Nenhuma rota de login/auth em `src/` | `/home/servidor/Git/node_js_app/src/routes.ts:7` (única rota: `POST /users`) |
| `MONGO_URI` sem credenciais tem precedência e anula `DB_USER`/`DB_PASS` do compose | `src/database/index.ts:5-6` + `docker-compose.yml:11` vs `:27-28` |
| `dotenv` está em `dependencies` mas nunca é importado | `package.json:36` vs `grep -rn dotenv src/` (vazio) |
| Zero arquivos de teste versionados | `find` por `*.test.*`/`*.spec.*`/`__tests__` → vazio; `README.md:62` admite |
| MongoDB 4.2 (EOL), porta 27018 publicada e root/root fixo | `docker-compose.yml:20`, `:23-24`, `:27-28` |
| Compose sem `healthcheck` e `depends_on` simples | `docker-compose.yml:17-18`; `grep healthcheck` → vazio |
| Dependências de produção sem uso (`restify`, `typeorm`, `nodemon`, `esm`) | `package.json:34,37,41,42,43` vs `grep -rn 'restify\|typeorm\|nodemon\|esm' src/` (vazio) |
| ESLint estende `airbnb-base`, que não está instalado | `.eslintrc.json:9` vs `package.json:13-32` |
| `make up` falha em clone novo (exige `.env`, que é ignorado pelo git) | `Makefile:1` + `.gitignore:3` — executado: `make -n up` → "Sem regra para processar o alvo '.env'" |
| README descreve `yarn dev1` inexistente e afirma `dotenv` em uso | `README.md:60`, `README.md:30` vs `package.json:7-12` |

## 2. Tabela de prioridades

| ID | Prioridade | Tema | Resumo |
|---|---|---|---|
| BUG-1 | [P0] | Banco | `MONGO_URI` sem credenciais ignora `DB_*` e falha contra Mongo autenticado |
| SEC-1 | [P0] | Segurança | Hash MD5 sem salt para senha |
| BUG-2 | [P1] | Testes | `jest.config.js` quebra ao ler `tsconfig.json` com comentários |
| SEC-2 | [P1] | Segurança | Nenhuma autenticação/autorização em nenhuma rota |
| BUG-3 | [P1] | Runtime | `dotenv` nunca carregado — env vars só existem no Docker |
| DEVOPS-1 | [P1] | Infra | Mongo 4.2 EOL + porta do banco publicada + root/root fixo |
| DEVOPS-4 | [P1] | CI | Build, lint, audit e validação Compose sem workflow automático |
| TEST-1 | [P1] | Testes | Zero arquivos de teste |
| BUG-4 | [P2] | Bugs | `err.message` cru no cliente; e-mail duplicado vira 400 com texto do Mongo |
| SEC-3 | [P2] | Segurança | E-mail sem validação de formato |
| DEVOPS-2 | [P2] | Infra | Sem `healthcheck`; app pode subir antes do banco aceitar conexões |
| IMP-1 | [P2] | Código | Dependências de produção não usadas entram na imagem Docker |
| IMP-3 | [P2] | Ferramenta | ESLint estende preset inexistente → lint não roda |
| TEST-2 | [P2] | Testes | Cobertura/threshold desabilitados no Jest |
| DOC-1 | [P2] | Docs | README manda rodar `yarn dev1` que não existe; afirma `dotenv` |
| DOC-2 | [P2] | Docs | `.env.example`/README não batem com as variáveis realmente lidas |
| DEVOPS-3 | [P3] | Infra | `make up` quebra sem `.env` |
| IMP-2 | [P3] | Ferramenta | `babel.config.js` morto (presets não instalados; Jest usa ts-jest) |
| IMP-4 | [P3] | Código | Imports mortos e tipos `String` no service |

## 3. Segurança

### SEC-1 — Senha protegida com MD5 sem salt [P0]

**Arquivo:** /home/servidor/Git/node_js_app/src/models/User.ts:19-28
**Evidência:** o schema aplica `set: value => crypto.createHash('md5').update(value).digest('hex')` no campo `password` (linhas 23-27). Existe hash (não é texto puro, e `select: false` na linha 22 evita a volta no documento), mas MD5 é rápido demais e não usa salt — não serve como KDF de senha.
**Impacto:** com o dump do banco, senhas são quebradas em massa por força bruta/rainbow tables; qualquer autenticação futura nasceria comprometida.
**Mudança:** trocar o `set` por bcrypt (salt embutido) ou argon2 — adicionar a dependência, manter `select: false` e definir migração para usuários já criados (redefinir ou re-hashear no primeiro login).
**Aceite:** `User.create({password: 'abc123'})` grava hash com prefixo de salt (`$2b$` no bcrypt) e `grep -R "md5" src/` não encontra nada.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n "createHash('md5')" src/models/User.ts && echo 'FAIL: MD5 presente' || echo 'OK: MD5 removido'
```

### SEC-2 — Nenhuma autenticação/autorização na API [P1]

**Arquivo:** /home/servidor/Git/node_js_app/src/routes.ts:7
**Evidência:** a única rota registrada é `router.post("/users", createUsersController.handle)` (`routes.ts:7`); `grep -rni 'login\|jwt\|bearer\|session' src/` não retorna nada; o controller lê `name, email, password` do body e responde sem checar credencial (`CreateUsersController.ts:7-10`).
**Impacto:** qualquer cliente anônimo cria usuários em massa (spam; o `unique` do e-mail ainda vira oráculo de enumeração); não existe sessão, então não há alavanca de controle de acesso quando o escopo crescer.
**Mudança:** decidir o escopo: havendo login, criar `POST /sessions` + middleware de sessão/JWT protegendo as rotas de escrita; sendo API pública de estudo, documentar como tal e aplicar rate limit.
**Aceite:** rotas de escrita retornam 401 sem token válido, ou o README declara a API pública e há rate limit ativo.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -rni 'login\|jwt\|bearer\|session' src/ || echo 'nenhuma autenticação em src/'
```

### SEC-3 — E-mail sem validação de formato [P2]

**Arquivo:** /home/servidor/Git/node_js_app/src/models/User.ts:11-17
**Evidência:** o campo `email` tem apenas `required`, `unique`, `lowercase` e `trim` (linhas 12-16); `grep -n 'match\|validate' src/models/User.ts` → vazio, e o service grava sem checar (`CreateUserService.ts:16`).
**Impacto:** `POST /users` aceita `email: "abc"`; dado sujo entra no banco e só falha tarde (ex.: envio de e-mail, integrações).
**Mudança:** adicionar `match` no schema (ou validação no controller/service) e responder 400 com mensagem clara.
**Aceite:** `POST /users` com `email: "abc"` retorna 400 com erro de e-mail inválido.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'match' src/models/User.ts || echo 'FAIL: sem validação de formato de e-mail'
```

## 4. Bugs e defeitos funcionais

### BUG-1 — `MONGO_URI` sem credenciais tem precedência e anula `DB_USER`/`DB_PASS` [P0]

**Arquivo:** /home/servidor/Git/node_js_app/src/database/index.ts:5-6
**Evidência:** `const uri = process.env.MONGO_URI || \`mongodb://${DB_USER}:${DB_PASS}@...\`` (linhas 5-6) — quando `MONGO_URI` existe, ela é usada por inteiro. O compose define `MONGO_URI=mongodb://db:27017/appdb?authSource=admin` **sem usuário/senha** (`docker-compose.yml:11`), define `DB_USER=root`/`DB_PASS=root` (`docker-compose.yml:12-13`) que ficam ignorados nesse caminho, e o Mongo sobe autenticado com `MONGO_INITDB_ROOT_USERNAME: root` / `MONGO_INITDB_ROOT_PASSWORD: root` (`docker-compose.yml:27-28`).
**Impacto:** com `docker-compose up`, a aplicação conecta sem credencial a um Mongo que as exige → operações falham com erro de autenticação e a API não cria usuário com a stack do próprio repositório.
**Mudança:** eliminar a duplicidade de fonte: ou montar `MONGO_URI` com as credenciais (lendo de env), ou remover `MONGO_URI` do compose e deixar o fallback de `database/index.ts:5-6` montar a URI a partir de `DB_*`.
**Aceite:** com o compose subido, `POST /users` responde 200 e o log imprime `database connected` (`src/database/index.ts:17`) sem erro de autenticação.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'MONGO_URI' docker-compose.yml src/database/index.ts && grep -n 'MONGO_INITDB_ROOT_PASSWORD' docker-compose.yml
```

### BUG-2 — `npm test` aborta: `jest.config.js` exige JSON sem comentários [P1]

**Arquivo:** /home/servidor/Git/node_js_app/jest.config.js:1-2
**Evidência:** a config começa com `require('./tsconfig.json')` (linha 1), mas `tsconfig.json:3` usa comentários JSONC (padrão do TypeScript), que o `require` do Node não aceita. **Executado neste checkout:** `node -e "require('./jest.config.js')"` → `SyntaxError: /home/servidor/Git/node_js_app/tsconfig.json: Expected double-quoted property name in JSON at position 80 (line 3)`; o mesmo erro derruba `npx jest --listTests`.
**Impacto:** `npm test` falha antes de qualquer teste — o Jest configurado (`package.json:11`) é inutilizável enquanto o tsconfig mantiver comentários.
**Mudança:** parsear o tsconfig com parser JSONC (ex.: `ts.readConfigFile`/`jsonc-parser`) em vez de `require`, ou declarar o `moduleNameMapper` direto no `jest.config.js` (a linha 79 já usa `compilerOptions.paths`).
**Aceite:** `node -e "require('./jest.config.js')"` imprime `CONFIG OK` e `npx jest --listTests` chega a listar os testes (ou a dizer que não há).
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && node -e "try{require('./jest.config.js');console.log('CONFIG OK')}catch(e){console.log('FAIL:',e.message.split('\n')[0])}"
```

### BUG-3 — `dotenv` declarado mas nunca carregado [P1]

**Arquivo:** /home/servidor/Git/node_js_app/src/server.ts:22
**Evidência:** `dotenv` está em `dependencies` (`package.json:36`), mas `grep -rn 'dotenv' src/` não retorna nenhum import — ninguém chama `dotenv.config()`. O servidor lê `process.env.SERVER_PORT` direto (`server.ts:22`) e o banco lê `DB_*`/`MONGO_URI` (`src/database/index.ts:3-6`). Só o `docker-compose.yml:8-16` injeta as variáveis; fora do Docker, nada as define.
**Impacto:** `npm run dev` localmente sobe com `SERVER_PORT` indefinido (porta aleatória do `listen`) e monta URI `mongodb://undefined:undefined@...`; o README manda rodar `yarn dev` com `.env` (`README.md:54`), o que não funciona.
**Mudança:** adicionar `import 'dotenv/config'` como primeira linha de `src/server.ts` (a dependência já existe) — ou remover `dotenv` do package.json e corrigir o README.
**Aceite:** com `.env` contendo `SERVER_PORT=3333`, `npm run dev` anuncia `http://localhost:3333/` (`server.ts:22`).
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -rn 'dotenv' src/ || echo 'FAIL: dotenv nunca é importado em src/'
```

### BUG-4 — `err.message` cru no cliente; e-mail duplicado vira 400 com texto do Mongo [P2]

**Arquivo:** /home/servidor/Git/node_js_app/src/server.ts:13-14
**Evidência:** o middleware devolve `400 { err: err.message }` para **qualquer** `Error` (linhas 13-14), sem logar. `User.create` (`src/services/CreateUserService.ts:16`) pode estourar o índice `unique` do e-mail (`src/models/User.ts:14`), cujo `E11000` é `instanceof Error` → a mensagem interna do Mongo vai ao cliente com status 400 (errado: duplicidade é 409; erro inesperado seria 500).
**Impacto:** vazamento de detalhes internos (strings do driver/DB), status semanticamente errados e nenhum registro do erro no servidor.
**Mudança:** mapear `E11000` → 409 `{ error: 'e-mail já cadastrado' }`, tratar `ValidationError` do Mongoose → 400, e trocar o `400` genérico por 500 com `console.error(err)` para o resto.
**Aceite:** `POST /users` duas vezes com o mesmo e-mail → primeira 200, segunda 409 com mensagem própria, sem texto do Mongo na resposta.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'E11000\|console.error' src/server.ts src/services/CreateUserService.ts || echo 'FAIL: sem mapeamento de erro de duplicidade'
```

## 5. Qualidade: testes

### TEST-1 — Nenhum arquivo de teste versionado [P1]

**Arquivo:** /home/servidor/Git/node_js_app/package.json:11
**Evidência:** o script existe (`"test": "jest"`, linha 11) e o Jest está configurado, mas `find . -path ./node_modules -prune -o \( -name '*.test.*' -o -name '*.spec.*' -o -name '__tests__' \) -print` não retorna nada neste checkout; o próprio README admite: `yarn test # jest — não há arquivos de teste versionados` (`README.md:62`).
**Impacto:** qualquer refactor (ex.: trocar MD5 por bcrypt — SEC-1) é feito sem rede de segurança; a config inteira do Jest (`jest.config.js:1-185`) está sem uso real.
**Mudança:** criar ao menos: (a) teste unitário do model (hash aplicado, `select: false`, e-mail único), (b) teste do `CreateUserService` com o Mongoose mockado/mongodb-memory-server, (c) teste de integração de `POST /users` (201/200, 400, 409).
**Aceite:** `npm test` roda com ≥3 testes verdes cobrindo model, service e rota.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && find . -path ./node_modules -prune -o \( -name '*.test.*' -o -name '*.spec.*' \) -print | grep . || echo 'FAIL: nenhum teste (esperado até TEST-1+BUG-2 serem feitos)'
```

### TEST-2 — Cobertura e threshold desabilitados no Jest [P2]

**Arquivo:** /home/servidor/Git/node_js_app/jest.config.js:17-44
**Evidência:** `collectCoverage`, `coverageDirectory`, `coverageReporters` e `coverageThreshold` existem apenas **comentados** (linhas 18, 22, 31 e 40: `// coverageThreshold: undefined`); não há flag de cobertura no script `test` (`package.json:11`).
**Impacto:** sem métrica de regressão — dá para remover o `set` de hash do model e o CI continuaria verde.
**Mudança:** habilitar `collectCoverageFrom: ['<rootDir>/src/**/*.ts']` e um piso inicial (ex.: 70%), além de `test:ci` com `jest --ci --coverage`.
**Aceite:** `npm run test:ci` imprime o relatório de cobertura e falha abaixo do threshold.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n '^\s*//\s*coverageThreshold' jest.config.js && echo 'FAIL: threshold apenas comentado' || echo 'OK: coverageThreshold ativo'
```

### IMP-2 — `babel.config.js` morto: presets não instalados e Jest usa ts-jest [P3]

**Arquivo:** /home/servidor/Git/node_js_app/babel.config.js:1-27
**Evidência:** o Jest declara `preset: 'ts-jest'` (`jest.config.js:91`), então o Babel nem é consultado; além disso `@babel/preset-env`/`@babel/preset-typescript`/`module-resolver` **não constam** no `package.json` (`grep -n '"@babel/preset' package.json` → vazio), o preset-typescript está duplicado (linhas 5 e 12) e a estrutura do array na linha 3 mistura preset e options de forma inválida para o Babel.
**Impacto:** configuração morta que confunde quem for adicionar transform; se alguém ativar `babel-jest`, quebra na hora por dependências ausentes.
**Mudança:** apagar `babel.config.js` (o `ts-jest` já transpila TS) ou, se Babel for desejado, instalar os presets/plugins e usar `babel-jest` exclusivamente — nunca os dois.
**Aceite:** não existe `babel.config.js`, e `npx jest --showConfig` aponta apenas o preset `ts-jest`.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && (test -f babel.config.js && grep -n 'preset' jest.config.js || echo 'removido/babel em uso') && grep -n '"@babel/preset' package.json || echo 'FAIL: presets do Babel não instalados'
```

### IMP-3 — ESLint estende `airbnb-base`, que não está instalado [P2]

**Arquivo:** /home/servidor/Git/node_js_app/.eslintrc.json:9
**Evidência:** `"extends": ["airbnb-base"]` (linha 9), mas `grep -n 'eslint-config-airbnb-base' package.json` → vazio; o que está instalado é `eslint-config-prettier` (`package.json:19`) e `eslint-config-standard` (`package.json:20`), nenhum dos dois referenciado no `.eslintrc.json`. O parser/plugin TypeScript também não aparece em `extends` (linhas 10, 16).
**Impacto:** `npx eslint .` falha com "Failed to load config airbnb-base" → o lint prometido pela stack não roda em nenhum ambiente (também não há script `lint` no `package.json:7-12`).
**Mudança:** trocar `extends` por `plugin:@typescript-eslint/recommended` + `prettier` (já instalados) **ou** instalar `eslint-config-airbnb-base` com as peer deps; adicionar script `"lint": "eslint . --ext .ts"`.
**Aceite:** `npx eslint src --ext .ts` termina sem erro de configuração.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'airbnb' .eslintrc.json && (grep -q 'eslint-config-airbnb-base' package.json && echo 'OK: preset instalado' || echo 'FAIL: airbnb-base ausente no package.json')
```

### IMP-4 — Imports mortos e tipos `String` no service [P3]

**Arquivo:** /home/servidor/Git/node_js_app/src/services/CreateUserService.ts:1-11
**Evidência:** linhas 1-3 fazem `require('mongoose')` e declaram `Schema` sem uso; a linha 6 importa `uuid` (`import { v4 as uuid } from 'uuid'`) que nunca é chamado (o corpo, linhas 15-17, só usa `User`); a interface `IUserRequest` usa o objeto `String` (linhas 9-11) em vez do primitivo `string`.
**Impacto:** ruído que atrapalha leitura e revisão; bundling/compilação desnecessários; `String` (objeto) enfraquece a checagem de tipos com `strict` quando ligado (`tsconfig.json:18`).
**Mudança:** remover as linhas 1-3 e 6; trocar por `name: string, email: string, password: string`.
**Aceite:** `grep -n 'uuid\|mongoose\|String,' src/services/CreateUserService.ts` não encontra resíduos e o `tsc --noEmit` passa.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'uuid\|Schema' src/services/CreateUserService.ts || echo 'OK: imports mortos removidos'
```

## 6. DevOps / Infra

### DEVOPS-1 — MongoDB 4.2 (EOL), porta do banco publicada e root/root fixo no repositório [P1]

**Arquivo:** /home/servidor/Git/node_js_app/docker-compose.yml:20
**Evidência:** `image: mongo:4.2` (linha 20 — versão com suporte encerrado há anos; o README a repete em `README.md:28`); `ports: - "27018:27017"` publica a porta do Mongo no host (linhas 23-24); `MONGO_INITDB_ROOT_USERNAME: root` / `MONGO_INITDB_ROOT_PASSWORD: root` (linhas 27-28) são credenciais fracas fixadas no versionamento.
**Impacto:** banco sem correções de segurança, atacável se a porta 27018 estiver exposta, com senha pública — qualquer um com acesso à rede alcança dados de produção se o mesmo arquivo for usado fora do localhost.
**Mudança:** atualizar para uma versão suportada (validar compatibilidade com o driver do Mongoose 5, `package.json:40` — atualizar Mongoose se for a Mongo atual), remover o mapeamento de porta (a rede interna do compose basta; usar `127.0.0.1:27018:27017` se for manter) e mover credenciais para `.env` fora do git.
**Aceite:** `docker compose config` não mostra porta pública sem bind local nem senha literal; imagem com tag suportada.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'mongo:4\|27018\|ROOT_PASSWORD' docker-compose.yml
```

### DEVOPS-2 — Compose sem `healthcheck` e `depends_on` sem condição [P2]

**Arquivo:** /home/servidor/Git/node_js_app/docker-compose.yml:17-18
**Evidência:** `depends_on: - db` apenas (linhas 17-18) — ordem de subida, não prontidão; `grep -n healthcheck docker-compose.yml` → "sem healthcheck" (executado). O `app` tem `restart: unless-stopped` (linha 5) e a conexão do banco (`src/database/index.ts:7-14`) só registra `error` logando, sem sair/reconectar com política (linhas 16-17).
**Impacto:** em `docker compose up` frio, o Node pode falar com o Mongo antes deste aceitar conexões → erro inicial, com restarts e logs poluídos; o log `connection error:` (linha 16) nem diz qual falhou.
**Mudança:** adicionar `healthcheck` no `db` (`mongosh --eval "db.adminCommand('ping')"`), usar `depends_on: db: condition: service_healthy` (compose v2) e tratar a falha de conexão no app (retry/falhar rápido).
**Aceite:** `docker compose up -d` seguido de `docker compose logs app` mostra `database connected` sem tentativas de erro.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && (grep -n 'healthcheck' docker-compose.yml || echo 'FAIL: sem healthcheck') && grep -n -A2 'depends_on' docker-compose.yml
```

### DEVOPS-3 — `make up` falha em clone novo porque exige `.env` [P3]

**Arquivo:** /home/servidor/Git/node_js_app/Makefile:1
**Evidência:** a primeira linha é `include .env`, mas `.gitignore:3` ignora `.env` e o repositório só traz `.env.example` (ls da raiz). **Executado neste checkout:** `make -n up` → `Makefile:1: .env: Arquivo ou diretório inexistente` / `make: *** Sem regra para processar o alvo '.env'. Pare.`
**Impacto:** o primeiro comando que o README manda rodar (`README.md:51` `make up`) quebra em qualquer clone novo, antes mesmo do Docker.
**Mudança:** usar `-include .env` (opcional) e/ou documentar `cp .env.example .env` como passo zero; como o compose tem valores literais (`docker-compose.yml:11-16`), o `.env` hoje só serve para o Makefile.
**Aceite:** clone novo sem `.env`: `make up` sobe o stack (ou falha com mensagem instruindo a copiar o exemplo).
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && (make -n up 2>&1 | head -2)
```

### IMP-1 — Dependências de produção não usadas entram na imagem Docker [P2]

**Arquivo:** /home/servidor/Git/node_js_app/package.json:34,37,41,42,43
**Evidência:** `dependencies` declara `@types/restify` (34), `esm` (37), `nodemon` (41), `restify` (42) e `typeorm` (43), mas `grep -rn 'restify\|typeorm\|nodemon\|esm' src/` → vazio: a aplicação usa só `express` (`package.json:38`), `express-async-errors` (39) e `mongoose` (40). `@types/*` e `nodemon` são ferramentas de desenvolvimento (pertenceriam a `devDependencies`, como as demais em `package.json:13-32`).
**Impacto:** o estágio de produção do Docker (`Dockerfile:13`, `npm ci --omit=dev`) instala um ORM e um servidor HTTP alternativos sem uso → imagem maior, tempo de build pior e superfície de ataque desnecessária (ex.: `restify` traz CVEs próprias).
**Mudança:** remover `restify`, `typeorm`, `esm` e `nodemon` do `package.json`; mover `@types/restify`/`@types/uuid` (este já está em dependencies, linha 35) para `devDependencies` — `uuid` sequer está em `dependencies` apesar do import morto em `CreateUserService.ts:6`.
**Aceite:** após `npm install`, `npm ls restify typeorm nodemon esm` não lista nenhum.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -rn 'restify\|typeorm\|nodemon\|\besm\b' src/ || echo 'FAIL: declarados no package.json mas não usados em src/'
```

## 7. Documentação

### DOC-1 — README descreve script inexistente e afirma `dotenv` em uso [P2]

**Arquivo:** /home/servidor/Git/node_js_app/README.md:60
**Evidência:** o README lista `yarn dev1   # variante com nodemon + dotenv` (linha 60), mas o `package.json:7-12` só tem `build`, `start`, `dev` e `test` (confirmado: `grep -n 'dev1' package.json` → vazio). Também afirma "**dotenv** para configuração" (`README.md:30`), enquanto `grep -rn dotenv src/` não acha import (ver BUG-3), e diz que o compose "sobe um `mongo:4.2` usando as variáveis do `.env`" (`README.md:23`), enquanto o compose tem valores literais.
**Impacto:** comandos documentados falham na cara do novo dev; expectativa de configuração flexível não corresponde ao comportamento real.
**Mudança:** remover a linha `dev1`, corrigir a seção de stack/variáveis para descrever o comportamento real (injetado pelo compose) e reescrever após BUG-3/DOC-2.
**Aceite:** cada comando de código do README roda sem erro em um clone novo.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -n 'dev1' README.md && (grep -q '"dev1"' package.json && echo 'OK: script existe' || echo 'FAIL: dev1 documentado mas não existe')
```

### DOC-2 — `.env.example` e README não batem com as variáveis realmente lidas pelo código [P2]

**Arquivo:** /home/servidor/Git/node_js_app/.env.example:4-10
**Evidência:** o exemplo só traz `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME` e `SERVER_PORT=3333` (linhas 4-10); **não** documenta `MONGO_URI`, que tem precedência no código (`src/database/index.ts:5`), nem `PORT`, que o compose define e que ninguém lê (`docker-compose.yml:9` vs `server.ts:22` que usa `SERVER_PORT`). O README repete o mesmo bloco (`README.md:39-46`) e promete `http://localhost:$SERVER_PORT` (`README.md:54`) — que só funciona se o `dotenv` do BUG-3 for corrigido.
**Impacto:** o usuário edita `.env.example` achando que controla a conexão, mas `MONGO_URI` do compose ignora `DB_*`; `PORT` é var morta → configuração confusa e divergente entre local e Docker.
**Mudança:** listar no `.env.example` exatamente as variáveis lidas em `src/` (`SERVER_PORT`, `MONGO_URI` **ou** `DB_*`, escolhendo um), remover `PORT` do compose, e alinhar o README ao comportamento efetivo.
**Aceite:** `grep -oE '(SERVER_PORT|MONGO_URI|DB_[A-Z]+)' src/**/*.ts` bate 1:1 com as chaves de `.env.example`; não há var definida e não lida.
**Verificação:**
```bash
cd /home/servidor/Git/node_js_app && grep -rn 'process.env' src/ && echo '--- .env.example ---' && grep -v '^#' .env.example | grep -v '^$'
```

## 8. Ordem de execução (waves)

**Wave 0 — destravar a base (1 sessão):**
1. **BUG-1** — sem isso a stack do compose não grava nada.
2. **BUG-2** — sem isso nenhum teste pode ser escrito/executado.
3. **BUG-3** — `import 'dotenv/config'` para o dev local funcionar.

**Wave 1 — segurança e infra (1-2 sessões):**
4. **SEC-1** — MD5 → bcrypt/argon2 (com TEST-1 em paralelo: escrever o teste do hash antes de trocar).
5. **SEC-2** — decisão de escopo de autenticação (mesmo que seja "API pública + rate limit", precisa estar decidido e documentado).
6. **DEVOPS-1** — Mongo suportado, porta sem exposição, segredos fora do git.

**Wave 2 — qualidade (2 sessões):**
7. **TEST-1** — primeiros testes (model, service, `POST /users`).
8. **TEST-2** — cobertura + threshold + script `test:ci`.
9. **BUG-4** — mapeamento de erros (faça junto com os testes de 409/400).
10. **SEC-3** — validação de e-mail (cobre-se com o teste criado em TEST-1).
11. **IMP-3** — ESLint funcional + script `lint`.

**Wave 3 — limpeza, docs e CI (1 sessão):**
12. **IMP-1**, **IMP-2**, **IMP-4** — dependências e código morto.
13. **DEVOPS-2**, **DEVOPS-3** — healthcheck e `make` tolerante.
14. **DOC-1**, **DOC-2** — README/`.env.example` alinhados ao código já corrigido.
15. **DEVOPS-4** — workflow de lint/build/audit/Compose sem executar testes ou serviços.

Dependências explícitas: BUG-2 → TEST-1 → TEST-2; TEST-1 → SEC-1/SEC-3/BUG-4 (testes antes/depois da mudança); DOC-1/DOC-2 depois de BUG-3.

## 9. Fora de escopo / riscos

**Fora de escopo (não fazer agora):**
- Trocar Express ou reescrever a arquitetura em camadas — a estrutura atual (controller/service/model) está adequada ao tamanho da API.
- Adicionar frontend, ORM novo ou migrar Mongoose para TypeORM (`typeorm` está no package.json, mas é item de remoção — IMP-1, não de adoção).
- Completa cobertura de testes (>90%) — a meta inicial é a suíte mínima do TEST-1.

**Riscos das mudanças propostas:**
- **SEC-1:** usuários já criados têm hash MD5 — trocar o `set` invalida senhas existentes; é preciso plano de migração (redefinição ou re-hash no primeiro login). Não fazer silenciosamente.
- **DEVOPS-1:** atualizar a imagem do Mongo pode exigir atualizar o Mongoose (`package.json:40`, driver antigo) — testar `docker compose up` completo antes de merge.
- **BUG-1:** corrigir a URI muda o ponto de conexão — quem já subiu o stack manualmente pode ter `.env` local divergente; documentar a variável escolhida.
- **IMP-1:** remover `nodemon`/`esm` é seguro apenas porque nada os referencia em `src/` (verificado por grep); manter o `package-lock.json` atualizado.

## 10. Definição de pronto (DoD)

O plano está concluído quando **todos** os pontos abaixo forem verdadeiros, verificáveis por comando:

1. `node -e "require('./jest.config.js')"` → `CONFIG OK` (**BUG-2**) e `npm test` executa.
2. Suíte com ≥3 testes verdes e cobertura com threshold ativo (**TEST-1**, **TEST-2**).
3. `grep -R "md5" src/` vazio; hash com salt no `User.create` (**SEC-1**).
4. Decisão de auth implementada/documented: 401 em rota protegida ou "API pública + rate limit" no README (**SEC-2**).
5. `docker compose up -d` + `POST /users` → 200 e `database connected` sem erro de autenticação (**BUG-1**).
6. `npm run dev` local sobe na porta do `.env` (**BUG-3**).
7. E-mail duplicado → 409 com mensagem própria; nenhum texto do Mongo na resposta (**BUG-4**); e-mail inválido → 400 (**SEC-3**).
8. `docker compose config` sem senha literal e sem porta do Mongo publicada (**DEVOPS-1**); `healthcheck` presente (**DEVOPS-2**).
9. `npx eslint src --ext .ts` roda sem erro de config (**IMP-3**); `grep` de `restify|typeorm|nodemon|esm` vazio em `package.json` (**IMP-1**).
10. Clone novo sem `.env`: `make up` funciona (**DEVOPS-3**); todos os comandos do README rodam (**DOC-1**) e `.env.example` bate com `process.env` lido em `src/` (**DOC-2**).
11. `python3 /tmp/validate.py node_js_app` → **OK**.
12. A CI Node 22/24 conclui lint, build, audit e configuração Compose sem executar testes ou serviços (**DEVOPS-4**).

---

*Fim do plano. Gerado por leitura direta do código em 2026-10-05 — todos os `arquivo:linha` provêm de `/home/servidor/Git/node_js_app/` (branch `master`); alegações de execução (SyntaxError do Jest, `make -n up`, greps vazios) foram reproduzidas neste checkout antes da escrita.*

