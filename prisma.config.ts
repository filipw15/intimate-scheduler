import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: path.resolve(".env") });

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrate: {
    async adapter(env: Record<string, string | undefined>) {
      return new PrismaPg({ connectionString: env["DATABASE_URL"] });
    },
  },
});
