import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env");

if (existsSync(envPath)) {
  console.log(".env já existe; ele foi mantido.");
  process.exit(0);
}

const template = readFileSync(resolve(projectRoot, ".env.example"), "utf8");
const envContents = template
  .replace(
    /^DB_USER=__GENERATE__$/m,
    `DB_USER=app_${randomBytes(8).toString("hex")}`,
  )
  .replace(
    /^DB_PASS=__GENERATE__$/m,
    `DB_PASS=${randomBytes(32).toString("base64url")}`,
  )
  .replace(
    /^JWT_SECRET=__GENERATE__$/m,
    `JWT_SECRET=${randomBytes(48).toString("base64url")}`,
  );

writeFileSync(envPath, envContents, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});
chmodSync(envPath, 0o600);
console.log(
  "Arquivo .env criado com credenciais aleatórias e permissões 0600.",
);
