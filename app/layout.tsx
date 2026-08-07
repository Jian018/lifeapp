import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "My Life System", template: "%s · My Life System" },
  description: "A private-control, public-view personal operating system for movement, nutrition and life direction.",
  applicationName: "My Life System",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Life System" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "My Life System",
    description: "Run your day. Shape your life.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "My Life System dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Life System",
    description: "Run your day. Shape your life.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable} dark`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
