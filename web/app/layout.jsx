import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = "https://specto.app";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SPECTO — ИИ-менеджер продаж в WhatsApp",
    template: "%s · SPECTO",
  },
  description:
    "SPECTO — ИИ-менеджер «Алина», который отвечает лидам в WhatsApp за секунды, квалифицирует их, ведёт догоняющие сообщения и не даёт упустить ни одного горячего клиента.",
  keywords: [
    "WhatsApp бот",
    "ИИ менеджер продаж",
    "квалификация лидов",
    "автоматизация продаж",
    "CRM",
    "SPECTO",
  ],
  openGraph: {
    title: "SPECTO — ИИ-менеджер продаж в WhatsApp",
    description:
      "Отвечает лидам за секунды, квалифицирует и догоняет — 24/7. Ваши менеджеры работают только с горячими.",
    url: siteUrl,
    siteName: "SPECTO",
    locale: "ru_RU",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0A0A0B",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
    >
      <head>
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
      </head>
      <body className="grain min-h-screen">{children}</body>
    </html>
  );
}
