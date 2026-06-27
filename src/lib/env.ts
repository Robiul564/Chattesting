import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  META_APP_SECRET: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
});

export const env = schema.parse(process.env);
