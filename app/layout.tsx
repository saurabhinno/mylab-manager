import "./globals.css";
import type { Metadata } from "next";
import ThemeRegistry from "@/components/ThemeRegistry";

export const metadata: Metadata = {
  title: "MyLab — Diagnostics Portal",
  description: "Blood test reporting platform for doctors and lab staff.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
