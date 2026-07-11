/**
 * Area-график «поток лидов + депозиты». Точный перенос inline-SVG из макета,
 * но данные приходят пропсами. Чистый компонент — рендерится на сервере.
 */
type Props = {
  leads: number[];
  deps: number[];
  max?: number;
};

const W = 720;
const H = 220;
const PAD = 28;

export default function AreaChart({ leads, deps, max: maxProp }: Props) {
  const max = maxProp ?? Math.max(10, ...leads, ...deps) * 1.15;
  const n = Math.max(leads.length, 2);
  const x = (i: number) => PAD + i * ((W - PAD * 2) / (n - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 1.4);

  const path = (d: number[], close: boolean) => {
    if (d.length === 0) return "";
    let p = "M" + x(0) + "," + y(d[0]);
    for (let i = 1; i < d.length; i++) p += " L" + x(i) + "," + y(d[i]);
    if (close) p += " L" + x(d.length - 1) + "," + (H - PAD) + " L" + x(0) + "," + (H - PAD) + " Z";
    return p;
  };

  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const gy = PAD + i * ((H - PAD * 1.4) / 4);
    grid.push(<line key={i} x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="var(--border)" strokeWidth={1} />);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--green)" stopOpacity=".22" />
          <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid}
      <path d={path(leads, true)} fill="url(#ga)" />
      <path d={path(leads, false)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={path(deps, true)} fill="url(#gb)" />
      <path d={path(deps, false)} fill="none" stroke="var(--green)" strokeWidth={2.5} strokeLinejoin="round" />
      {leads.map((v, i) =>
        i % 2 ? null : (
          <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
        ),
      )}
    </svg>
  );
}
