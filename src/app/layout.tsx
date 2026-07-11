import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadHub — Lead Distribution CRM",
  description:
    "CRM для аффилейт-команды: приём лидов, отгрузка в офисы по API, real-time статусы, аналитика по брендам и периодам.",
};

// Устанавливаем тему до первой отрисовки, чтобы не было мигания (FOUC).
const themeBoot = `(function(){try{var t=localStorage.getItem('leadhub-theme')||'dark';document.body.setAttribute('data-theme',t);}catch(e){document.body.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body data-theme="dark" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {children}
      </body>
    </html>
  );
}
