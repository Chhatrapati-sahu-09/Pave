import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";

export const metadata: Metadata = {
  title: "Pave — Sidewalk Accessibility Map",
  description: "Report and browse sidewalk accessibility issues (broken pavement, blocked paths, missing ramps) on a crowdsourced color-coded heatmap.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#F5F2EA] text-[#0A0A0A]">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
