import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { ApiError } from "../errors/ApiError";
import { User } from "../models/User";
import { toPublicUser } from "./CreateUserService";
import { BCRYPT_SHA256_PREFIX, prehashPassword } from "../utils/passwordHash";

const LEGACY_MD5_PATTERN = /^[a-f\d]{32}$/i;

export class AuthenticateUserService {
  private readonly dummyHash = bcrypt.hashSync(
    randomBytes(32).toString("hex"),
    12,
  );

  async execute(emailInput: unknown, passwordInput: unknown) {
    if (
      typeof emailInput !== "string" ||
      typeof passwordInput !== "string" ||
      !passwordInput
    ) {
      throw new ApiError(400, "Informe e-mail e senha.");
    }

    const email = emailInput.trim().toLowerCase();
    const user = await User.findOne({ email }).select("+password");
    const storedHash = user?.password ?? this.dummyHash;
    const isUpgradedHash = storedHash.startsWith(BCRYPT_SHA256_PREFIX);

    let passwordMatches = false;
    if (isUpgradedHash) {
      const bcryptHash = storedHash.slice(BCRYPT_SHA256_PREFIX.length);
      passwordMatches = await bcrypt.compare(
        prehashPassword(passwordInput),
        bcryptHash,
      );
    } else if (user && LEGACY_MD5_PATTERN.test(storedHash)) {
      const expectedHash = createHash("md5").update(passwordInput).digest();
      const storedDigest = Buffer.from(storedHash, "hex");
      passwordMatches = timingSafeEqual(expectedHash, storedDigest);

      // Hashing a fixed-size SHA-256 digest first preserves the full legacy password
      // without bcrypt's 72-byte input limit.
      if (passwordMatches) {
        const bcryptHash = await bcrypt.hash(
          prehashPassword(passwordInput),
          12,
        );
        const upgradedHash = `${BCRYPT_SHA256_PREFIX}${bcryptHash}`;
        await User.updateOne(
          { _id: user._id },
          { $set: { password: upgradedHash } },
        );
      }
    }

    if (!user || !passwordMatches) {
      if (!isUpgradedHash) {
        await bcrypt.compare(passwordInput, this.dummyHash);
      }
      throw new ApiError(401, "E-mail ou senha inválidos.");
    }

    return toPublicUser(user);
  }
}
