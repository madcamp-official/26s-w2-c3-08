// Prisma 클라이언트 싱글턴. DATABASE_URL은 server/.env (gitignore).
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** BigInt(id)는 JSON.stringify가 안 되므로 문자열로 직렬화하는 헬퍼 */
export function jsonSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)));
}
