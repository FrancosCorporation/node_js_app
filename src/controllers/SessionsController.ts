import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticateUserService } from "../services/AuthenticateUserService";

const JWT_ISSUER = "node-js-app";
const JWT_AUDIENCE = "node-js-app-api";

export class SessionsController {
  private readonly authenticateUser = new AuthenticateUserService();

  constructor(private readonly jwtSecret: string) {}

  async handle(request: Request, response: Response): Promise<Response> {
    const { email, password } = request.body ?? {};
    const user = await this.authenticateUser.execute(email, password);
    const token = jwt.sign({}, this.jwtSecret, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE,
      expiresIn: "1h",
      issuer: JWT_ISSUER,
      subject: user.id,
    });

    return response.json({ token, tokenType: "Bearer", expiresIn: 3600, user });
  }
}
