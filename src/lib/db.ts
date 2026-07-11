import mongoose from "mongoose";

/**
 * Подключение к MongoDB.
 *
 * - Если задан MONGODB_URI — подключаемся к нему (Atlas / свой сервер).
 * - Иначе поднимаем встроенный in-memory MongoDB (mongodb-memory-server) —
 *   удобно для локальной разработки без установки СУБД. База засевается
 *   демо-данными автоматически (см. seedIfEmpty).
 *
 * Соединение кэшируется в globalThis, чтобы HMR в dev не плодил подключения.
 */

type MemoryServer = { getUri: () => string; stop: () => Promise<boolean> };

interface Cache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memory: MemoryServer | null;
}

const g = globalThis as unknown as { __leadhubDb?: Cache };
const cache: Cache = (g.__leadhubDb ??= { conn: null, promise: null, memory: null });

async function resolveUri(): Promise<string> {
  const configured = process.env.MONGODB_URI?.trim();
  if (configured) return configured;

  // In-memory режим (dev). Поднимаем один раз на процесс.
  if (!cache.memory) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    cache.memory = (await MongoMemoryServer.create({
      instance: { dbName: process.env.MONGODB_DB || "leadhub" },
    })) as unknown as MemoryServer;
    // eslint-disable-next-line no-console
    console.log("[leadhub] Запущен in-memory MongoDB для разработки.");
  }
  return cache.memory.getUri();
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = (async () => {
      const uri = await resolveUri();
      mongoose.set("strictQuery", true);
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB || "leadhub",
        serverSelectionTimeoutMS: 10_000,
      });
      // Ленивая загрузка сида, чтобы избежать циклических импортов.
      const { seedIfEmpty } = await import("@/lib/seed");
      await seedIfEmpty();
      return mongoose;
    })();
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
