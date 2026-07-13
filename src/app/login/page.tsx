"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Неверный email или пароль.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(79,124,255,.4)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 15l4-5 3 3 5-7" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.3px" }}>
              Lead<span style={{ color: "var(--accent)" }}>Hub</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>Lead Distribution CRM</div>
          </div>
        </div>

        <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Вход в панель</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Введите email и пароль для доступа.</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@leadhub.local" autoComplete="username" required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </div>

          {error && (
            <div style={{ background: "var(--red-soft)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            <LogIn size={16} />
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
            <b style={{ color: "var(--text-dim)" }}>Демо-доступы:</b>
            <br />
            admin@leadhub.local · admin12345 <span style={{ color: "var(--accent)" }}>(Админ)</span>
            <br />
            ivan@leadhub.local · demo1234 <span style={{ color: "var(--purple)" }}>(Пользователь)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
