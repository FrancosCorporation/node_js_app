import type { Request, Response } from "express";
import { User } from "../models/User";
import { toPublicUser } from "../services/CreateUserService";

export class ShowProfileController {
  async handle(request: Request, response: Response): Promise<Response> {
    const user = await User.findById(request.authUserId);
    if (!user) {
      return response.status(404).json({ error: "Usuário não encontrado." });
    }
    return response.json({ user: toPublicUser(user) });
  }
}
