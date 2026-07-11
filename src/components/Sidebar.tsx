"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { canAccess, ROLE_LABELS, type Role } from "@/lib/roles";

type Props = {
  userName?: string;
  userRole?: Role;
  badges?: Record<string, string>;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Sidebar({ userName = "LeadHub", userRole = "USER", badges = {} }: Props) {
  const pathname = usePathname();
  // Активный пункт вычисляем после монтирования — совпадает SSR и клиент (без hydration warning).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-7" />
          </svg>
        </div>
        <div>
          <div className="name">
            Lead<span>Hub</span>
          </div>
          <div className="sub">Lead Distribution CRM</div>
        </div>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((it) => canAccess(userRole, it.roles));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="nav-label">{group.label}</div>
              {items.map((it) => {
                const Icon = it.icon;
                const active = mounted && (pathname === it.href || pathname.startsWith(it.href + "/"));
                const badge = badges[it.href] ?? it.badge;
                return (
                  <Link key={it.href} href={it.href} className={`nav-item${active ? " active" : ""}`}>
                    <Icon />
                    {it.label}
                    {badge && <span className={`nav-badge${it.badgeGrey ? " grey" : ""}`}>{badge}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="side-foot">
        <div className="side-user">
          <div className="av">{initials(userName)}</div>
          <div style={{ flex: 1 }}>
            <div className="nm">{userName}</div>
            <div className="rl">{ROLE_LABELS[userRole]}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Выйти"
            aria-label="Выйти"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#61718f", padding: 4, display: "flex" }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
