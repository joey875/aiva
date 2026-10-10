import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Instrument Sans (OFL), self-hosted so builds never depend on Google Fonts
const ui = localFont({
  src: "./fonts/instrument-sans-latin-wght-normal.woff2",
  variable: "--font-ui",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Aiva", template: "%s · Aiva" },
  description: "Your sales assistant.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e151c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
