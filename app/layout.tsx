import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Design Specs | Bookchaowalit",
  description: "A browser-local catalogue of visual work: titles, regions, tools, and review status.",
  keywords: ["design", "portfolio"],
  authors: [{ name: "Bookchaowalit", url: "https://bookchaowalit.com" }],
  creator: "Bookchaowalit",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Design Specs | Bookchaowalit",
    description: "A browser-local catalogue of visual work: titles, regions, tools, and review status.",
    siteName: "Bookchaowalit",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The font variable sits on <html>: the App shell tokens live on :root and read it from there.
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
