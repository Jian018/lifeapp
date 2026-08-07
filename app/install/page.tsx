"use client";

import { useEffect, useState } from "react";
import { Check, Download, Monitor, MoreVertical, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppSettings } from "@/components/app-settings";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallPage() {
  const { settings, text } = useAppSettings();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => { const handle = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); }; window.addEventListener("beforeinstallprompt", handle); return () => window.removeEventListener("beforeinstallprompt", handle); }, []);
  const install = async () => { if (!prompt) return; await prompt.prompt(); const result = await prompt.userChoice; if (result.outcome === "accepted") setPrompt(null); };
  return <div className="page-wrap"><header className="mb-8 md:mb-10"><p className="eyebrow mb-3">Progressive web app</p><h1 className="display-title">{text(`Install ${settings.websiteName}`, `安装 ${settings.websiteName}`)}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">{text("Launch it from your home screen in a focused, app-like window — on your phone or computer.", "从手机或电脑主屏幕，以接近独立应用的方式打开。")}</p>{prompt && <Button className="mt-5" onClick={() => void install()}><Download size={17} />Install on this device</Button>}</header>
    <section className="grid gap-4 md:grid-cols-3">
      <Card className="p-5 md:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/10 text-sky"><Smartphone size={20} /></span><p className="eyebrow mt-7">iPhone / iPad</p><h2 className="mt-2 font-display text-lg font-bold">Add from Safari</h2><ol className="mt-5 space-y-4 text-sm leading-6 text-zinc-400"><li className="flex gap-3"><Share className="mt-1 shrink-0 text-white" size={16} /><span>Open this site in Safari and tap the Share button.</span></li><li className="flex gap-3"><Download className="mt-1 shrink-0 text-white" size={16} /><span>Choose <b className="text-white">Add to Home Screen</b>.</span></li><li className="flex gap-3"><Check className="mt-1 shrink-0 text-acid" size={16} /><span>Confirm the name, then tap Add.</span></li></ol></Card>
      <Card className="p-5 md:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acid/10 text-acid"><Smartphone size={20} /></span><p className="eyebrow mt-7">Android</p><h2 className="mt-2 font-display text-lg font-bold">Install from Chrome</h2><ol className="mt-5 space-y-4 text-sm leading-6 text-zinc-400"><li className="flex gap-3"><MoreVertical className="mt-1 shrink-0 text-white" size={16} /><span>Open the Chrome menu in the top corner.</span></li><li className="flex gap-3"><Download className="mt-1 shrink-0 text-white" size={16} /><span>Tap <b className="text-white">Install app</b> or Add to Home Screen.</span></li><li className="flex gap-3"><Check className="mt-1 shrink-0 text-acid" size={16} /><span>Confirm to place it with your apps.</span></li></ol></Card>
      <Card className="p-5 md:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/10 text-coral"><Monitor size={20} /></span><p className="eyebrow mt-7">Mac / Windows</p><h2 className="mt-2 font-display text-lg font-bold">Install on desktop</h2><ol className="mt-5 space-y-4 text-sm leading-6 text-zinc-400"><li className="flex gap-3"><Download className="mt-1 shrink-0 text-white" size={16} /><span>Look for the install icon in Chrome or Edge’s address bar.</span></li><li className="flex gap-3"><Check className="mt-1 shrink-0 text-acid" size={16} /><span>Choose Install to open it in its own window.</span></li><li className="flex gap-3"><Monitor className="mt-1 shrink-0 text-white" size={16} /><span>Pin it to your taskbar or Dock if you like.</span></li></ol></Card>
    </section><div className="mt-5 rounded-2xl border border-line bg-white/[.02] p-4 text-xs leading-5 text-zinc-500">For localhost testing, supported browsers treat this origin as secure. In production, HTTPS is required. Management codes and protected API responses are never cached by the service worker.</div></div>;
}
