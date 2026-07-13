"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { LEAD_STATUS_BADGE, type LeadStatus } from "@/lib/enums";

interface Item {
  id: string;
  leadId: string;
  leadName: string;
  status: LeadStatus;
  statusLabel: string;
  source: string;
  at: string;
}

const timeFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/activity").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="icon-btn" onClick={() => setOpen((v) => !v)} title="Уведомления">
        <Bell size={18} />
        <span className="dot" />
      </div>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 46, width: 320, zIndex: 50, padding: 0, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,.3)" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13.5 }}>Последние события</div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {items.length === 0 && <div className="muted" style={{ padding: 16, fontSize: 13 }}>Событий пока нет.</div>}
            {items.map((it) => (
              <Link key={it.id} href={`/leads/${it.leadId}`} onClick={() => setOpen(false)}
                style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", alignItems: "center" }}>
                <span className={`badge ${LEAD_STATUS_BADGE[it.status]}`}>{it.statusLabel}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.leadName}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{it.source} · {timeFmt.format(new Date(it.at))}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
