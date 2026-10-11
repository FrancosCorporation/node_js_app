import { ApiError } from "../errors/ApiError";
import { User } from "../models/User";

interface CreateUserInput {
  name: unknown;
  email: unknown;
  password: unknown;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export class CreateUserService {
  async execute({
    name,
    email,
    password,
  }: CreateUserInput): Promise<PublicUser> {
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      throw new ApiError(
        400,
        "Informe nome, e-mail e senha em formato de texto.",
      );
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordBytes = Buffer.byteLength(password, "utf8");

    if (normalizedName.length < 1 || normalizedName.length > 100) {
      throw new ApiError(400, "O nome deve ter entre 1 e 100 caracteres.");
    }
    if (passwordBytes < 12 || passwordBytes > 1024) {
      throw new ApiError(400, "A senha deve ter entre 12 e 1024 bytes.");
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
    });

    return toPublicUser(user);
  }
}
