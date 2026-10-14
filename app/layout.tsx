import "./globals.css";
import type { Metadata } from "next";
import ThemeRegistry from "@/components/ThemeRegistry";
import ServiceWorker from "@/components/ServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import ElectronDialogPatch from "@/components/ElectronDialogPatch";

export const metadata: Metadata = {
  title: "MyLab — Diagnostics Portal",
  description: "Blood test reporting platform for doctors and lab staff.",
  manifest: "/manifest.json",
  themeColor: "#0f4c81",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyLab",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <ThemeRegistry>{children}</ThemeRegistry>
        <ElectronDialogPatch />
        <ServiceWorker />
        <InstallPrompt />
      </body>
    </html>
  );
}
