import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import GlobalToaster from "@/components/GlobalToaster";

const sora = Sora({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ApplyPilot - Turbocharge Your Job Search",
  description: "Auto-fill, track, and tailor your job applications without losing control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${sora.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <GlobalToaster />
        {children}
      </body>
    </html>
  );
}
