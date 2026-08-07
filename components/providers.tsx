"use client";

import { Toaster } from "sonner";
import { AdminProvider } from "@/components/admin-gate";
import { PwaRegister } from "@/components/pwa-register";
import { AppSettingsProvider } from "@/components/app-settings";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSettingsProvider><AdminProvider>{children}</AdminProvider></AppSettingsProvider>
      <PwaRegister />
      <Toaster theme="dark" position="top-center" toastOptions={{ className: "!border-line !bg-panel !text-white" }} />
    </>
  );
}
