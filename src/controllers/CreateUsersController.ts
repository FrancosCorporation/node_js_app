import type { Request, Response } from "express";
import { CreateUserService } from "../services/CreateUserService";

export class CreateUsersController {
  async handle(request: Request, response: Response): Promise<Response> {
    const service = new CreateUserService();
    const user = await service.execute(request.body ?? {});
    return response.status(201).json({ user });
  }
}
