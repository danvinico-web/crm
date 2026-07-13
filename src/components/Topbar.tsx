"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AddLeadModal from "@/components/AddLeadModal";
import NotificationsBell from "@/components/NotificationsBell";
import { metaForPath } from "@/lib/nav";

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const meta = metaForPath(pathname);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/leads?q=${encodeURIComponent(term)}` : "/leads");
  }

  return (
    <div className="topbar">
      <div>
        <div className="page-title">{meta.title}</div>
        <div className="page-sub">{meta.sub}</div>
      </div>
      <form className="search" onSubmit={submitSearch}>
        <Search size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: email, телефон, метка, гео, внешний ID…"
        />
      </form>
      <div className="top-actions">
        <ThemeToggle />
        <NotificationsBell />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          Добавить лид
        </button>
      </div>
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
