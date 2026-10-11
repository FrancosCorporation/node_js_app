import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { ApiError } from "./errors/ApiError";
import { connectDatabase } from "./database";
import { loadConfig } from "./config";
import { createRouter } from "./routes";

function createApp(jwtSecret: string): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => {
    const connected = mongoose.connection.readyState === 1;
    return response.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "unavailable",
      database: connected ? "connected" : "disconnected",
    });
  });
  app.use(createRouter(jwtSecret));
  app.use((_request, response) =>
    response.status(404).json({ error: "Rota não encontrada." }),
  );

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    next,
  ) => {
    void next;
    if (error instanceof ApiError) {
      return response.status(error.statusCode).json({ error: error.message });
    }

    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    ) {
      return response
        .status(400)
        .json({ error: "Os dados enviados são inválidos." });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return response
        .status(409)
        .json({ error: "Este e-mail já está cadastrado." });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      return response
        .status(400)
        .json({ error: "O corpo da requisição contém JSON inválido." });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      return response
        .status(413)
        .json({ error: "O corpo da requisição excede o limite de 32 KB." });
    }

    console.error("Unhandled request error:", error);
    return response.status(500).json({ error: "Erro interno do servidor." });
  };

  app.use(errorHandler);
  return app;
}

async function startServer(): Promise<void> {
  const config = loadConfig();
  await connectDatabase(config.mongoUri);

  const app = createApp(config.jwtSecret);
  const server = app.listen(config.port, config.host, () => {
    console.log(`API disponível em http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`${signal} recebido; encerrando a API.`);
    server.close(() => {
      void mongoose.disconnect().finally(() => {
        process.exitCode = 0;
      });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer().catch(async (error: unknown) => {
  console.error("Não foi possível iniciar a API:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
