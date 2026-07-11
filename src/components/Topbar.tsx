"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Plus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { metaForPath } from "@/lib/nav";

export default function Topbar() {
  const pathname = usePathname();
  const meta = metaForPath(pathname);

  return (
    <div className="topbar">
      <div>
        <div className="page-title">{meta.title}</div>
        <div className="page-sub">{meta.sub}</div>
      </div>
      <div className="search">
        <Search size={16} />
        <input placeholder="Поиск по имени, email, телефону, метке аффилиата…" />
      </div>
      <div className="top-actions">
        <ThemeToggle />
        <div className="icon-btn">
          <Bell size={18} />
          <span className="dot" />
        </div>
        <button className="btn btn-primary">
          <Plus size={16} />
          Добавить лид
        </button>
      </div>
    </div>
  );
}
