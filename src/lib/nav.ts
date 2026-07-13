import {
  LayoutDashboard,
  Users,
  UserCog,
  Share2,
  Send,
  Download,
  BarChart3,
  UsersRound,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeGrey?: boolean;
  /** минимальная роль для показа пункта */
  roles?: Role[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Разделы сайдбара — порядок и группировка как в макете. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Основное",
    items: [
      { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["ADMIN"] },
      { href: "/leads", label: "Лиды", icon: Users },
      { href: "/agents", label: "Агенты", icon: UserCog, roles: ["ADMIN", "USER"] },
      { href: "/affiliates", label: "Аффилиаты", icon: Share2, roles: ["ADMIN", "USER"] },
    ],
  },
  {
    label: "Дистрибуция",
    items: [
      { href: "/distribution", label: "Отправка в офисы", icon: Send, roles: ["ADMIN"] },
      { href: "/import", label: "Импорт лидов", icon: Download, roles: ["ADMIN"] },
      { href: "/reports", label: "Отчёты", icon: BarChart3, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Система",
    items: [
      { href: "/teams", label: "Команды", icon: UsersRound, roles: ["ADMIN", "USER"] },
      { href: "/users", label: "Пользователи", icon: ShieldCheck, roles: ["ADMIN"] },
      { href: "/settings", label: "Настройки", icon: Settings, roles: ["ADMIN", "USER"] },
    ],
  },
];

/** Заголовок и подзаголовок топбара по маршруту. */
export const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Дашборд", sub: "Обзор потока лидов и дистрибуции" },
  "/leads": { title: "Лиды", sub: "Фильтры, импорт и массовые действия" },
  "/agents": { title: "Агенты", sub: "Команда, роли, нагрузка и KPI" },
  "/affiliates": { title: "Аффилиаты", sub: "Источники трафика и выплаты" },
  "/distribution": { title: "Отправка в офисы", sub: "Интеграции, правила роутинга и логи" },
  "/import": { title: "Импорт лидов", sub: "Загрузка таблицей и приём по API" },
  "/reports": { title: "Отчёты", sub: "Аналитика по источникам, офисам и агентам" },
  "/teams": { title: "Команды", sub: "Ваши команды и агенты" },
  "/users": { title: "Пользователи", sub: "Управление доступом (только админ)" },
  "/settings": { title: "Настройки", sub: "Поля, дедуп, роли и доступы" },
};

export function metaForPath(pathname: string): { title: string; sub: string } {
  const key = Object.keys(PAGE_META).find(
    (k) => pathname === k || pathname.startsWith(k + "/"),
  );
  return key ? PAGE_META[key] : { title: "LeadHub", sub: "" };
}
