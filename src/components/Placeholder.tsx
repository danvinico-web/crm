import { Hammer } from "lucide-react";

/** Заглушка экрана для фазы 0 (каркас). Наполняется данными в следующих фазах. */
export default function Placeholder({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="card panel" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div className="ic i-blue" style={{ width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Hammer size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Экран в разработке</div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Каркас готов. {phase}
          </p>
          {children}
        </div>
      </div>
    </>
  );
}
