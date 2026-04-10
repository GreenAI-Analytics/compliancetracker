import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const metadataBase = new URL(process.env.APP_BASE_URL?.trim().replace(/\/$/, "") || "http://localhost:3000");

export const metadata: Metadata = {
  title: {
    default: "Compliance Tracker",
    template: "%s | Compliance Tracker",
  },
  description: "Compliance operations platform for EU SMEs: country and NACE-specific task tracking, reminders, and audit-ready workflows.",
  metadataBase,
  openGraph: {
    title: "Compliance Tracker",
    description: "Run country and NACE-specific compliance workflows without spreadsheet overhead.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
