export interface AppConfig {
  host: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `A variável ${name} é obrigatória. Execute "make init" e revise o arquivo .env.`,
    );
  }
  return value;
}

function buildMongoUri(): string {
  const configuredUri = process.env.MONGO_URI?.trim();
  if (configuredUri) return configuredUri;

  const username = encodeURIComponent(requiredEnvironmentVariable("DB_USER"));
  const password = encodeURIComponent(requiredEnvironmentVariable("DB_PASS"));
  const host = requiredEnvironmentVariable("DB_HOST");
  const port = requiredEnvironmentVariable("DB_PORT");
  const database = encodeURIComponent(requiredEnvironmentVariable("DB_NAME"));

  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("DB_PORT deve ser um número entre 1 e 65535.");
  }

  return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
}

export function loadConfig(): AppConfig {
  const portValue = process.env.SERVER_PORT ?? process.env.PORT ?? "3000";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SERVER_PORT deve ser um número entre 1 e 65535.");
  }

  const jwtSecret = requiredEnvironmentVariable("JWT_SECRET");
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error(
      'JWT_SECRET deve ter pelo menos 32 bytes. Execute "make init" para gerar um valor seguro.',
    );
  }

  const mongoUri = buildMongoUri();
  const host = process.env.HOST?.trim() || "127.0.0.1";
  return { host, port, mongoUri, jwtSecret };
}
