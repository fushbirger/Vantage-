import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vantage — split, pool, settle",
    template: "%s · Vantage",
  },
  description:
    "Brunei’s effortless, non-custodial group expense splitter and money-pooling companion. Track shared spending, simplify debts, and settle via tarus or Pocket.",
  applicationName: "Vantage",
  appleWebApp: { capable: true, title: "Vantage", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1e9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
