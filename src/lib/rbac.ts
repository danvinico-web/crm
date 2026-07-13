import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
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

/** API-гард: пускает только перечисленные роли, иначе 403. */
export async function requireRoles(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new HttpError(403, "Недостаточно прав");
  return user;
}

/**
 * Гард для серверных страниц: пускает только разрешённые роли, иначе редиректит.
 * Неавторизованных — на /login, остальных — на /leads (доступно всем ролям).
 */
export async function requirePageRole(allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect("/leads");
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
