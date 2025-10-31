import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";
import { Toaster } from "react-hot-toast";
import PushManager from "@/components/push/PushManager";
import SessionValidator from "@/components/SessionValidator";

export const metadata: Metadata = { title: "Lead & FB ID Portal" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <div className="mx-auto">
            <PushManager />
            <SessionValidator />

            {children}
            <Toaster position="top-center" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
