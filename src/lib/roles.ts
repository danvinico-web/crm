/**
 * Роли аккаунтов LeadHub.
 *
 * ADMIN — главный администратор платформы. Создаёт пользователей (USER),
 *         видит всё, управляет офисами/интеграциями и ключами.
 * USER  — пользователь (тимлид). Создаёт команды и агентов, работает с лидами
 *         и отправкой в рамках своих команд.
 *
 * «Агент» — доменная сущность (член команды, обрабатывает лиды), а не аккаунт входа.
 */
export const ROLES = ["ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  USER: "Пользователь",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Доступ к пункту навигации/действию по списку разрешённых ролей. */
export function canAccess(role: Role | undefined, allowed?: Role[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return !!role && allowed.includes(role);
}
