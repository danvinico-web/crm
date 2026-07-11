import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/roles";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** Ошибка с HTTP-статусом для обработчиков API. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Не авторизован");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Требуется роль администратора");
  return user;
}

/** Оборачивает обработчик API: ловит HttpError и отдаёт корректный JSON-ответ. */
export function apiHandler<T>(fn: () => Promise<T>): Promise<Response> {
  return fn()
    .then((data) => NextResponse.json(data))
    .catch((err) => {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // eslint-disable-next-line no-console
      console.error("[api] unhandled", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
        { status: 500 },
      );
    });
}
