import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

const JWT_ISSUER = "node-js-app";
const JWT_AUDIENCE = "node-js-app-api";

export function ensureAuthenticated(jwtSecret: string): RequestHandler {
  return (request, response, next) => {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return response.status(401).json({ error: "Autenticação necessária." });
    }

    try {
      const payload = jwt.verify(match[1], jwtSecret, {
        algorithms: ["HS256"],
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
      }) as JwtPayload;

      if (typeof payload.sub !== "string") {
        return response
          .status(401)
          .json({ error: "Token inválido ou expirado." });
      }

      request.authUserId = payload.sub;
      return next();
    } catch {
      return response
        .status(401)
        .json({ error: "Token inválido ou expirado." });
    }
  };
}
