"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Apple, CalendarCheck, Gauge, HeartPulse, House, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/components/app-settings";

const nav = [
  { href: "/", en: "Overview", zh: "首页", mobileEn: "Home", mobileZh: "首页", icon: House },
  { href: "/tasks", en: "Today’s Tasks", zh: "今日任务", mobileEn: "Tasks", mobileZh: "任务", icon: CalendarCheck },
  { href: "/lifecycle", en: "Lifecycle", zh: "生命周期", mobileEn: "Life", mobileZh: "生命", icon: HeartPulse },
  { href: "/calories", en: "Calories", zh: "卡路里", mobileEn: "Calories", mobileZh: "饮食", icon: Apple },
  { href: "/settings", en: "Settings", zh: "设置", mobileEn: "Settings", mobileZh: "设置", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings, text } = useAppSettings();
  const compact = settings.desktopSidebarMode === "compact";
  return (
    <div className="min-h-screen">
      <aside className={cn("desktop-only fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-[#090b0e]/95 py-7 backdrop-blur-xl transition-[width] duration-200", compact ? "w-[88px] px-3" : "w-64 px-4")}>
        <Link href="/" className={cn("mb-12 flex items-center gap-3 px-2", compact && "justify-center px-0")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-acid text-ink"><Activity size={22} strokeWidth={2.7} /></span>
          {!compact && <span><span className="block max-w-40 truncate font-display text-sm font-bold tracking-[-.02em]">{settings.websiteName}</span><span className="text-[10px] uppercase tracking-[.22em] text-zinc-600">Personal OS</span></span>}
        </Link>
        <nav className="space-y-1.5">
          {nav.map(({ href, en, zh, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} title={text(en, zh)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-zinc-500 transition-colors duration-200 hover:bg-white/[.04] hover:text-white", compact && "justify-center px-0", active && "bg-white/[.07] text-white")}><Icon size={19} className={cn(active && "text-acid")} />{!compact && text(en, zh)}</Link>;
          })}
        </nav>
        {!compact && <div className="mt-auto rounded-2xl border border-line bg-white/[.025] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-300"><Gauge size={15} className="text-acid" /> Local mode</div>
          <p className="text-[11px] leading-5 text-zinc-600">Private actions are protected. Public viewing stays open.</p>
        </div>}
      </aside>

      <header className="mobile-only sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-ink/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link href="/" className="max-w-[70vw] truncate font-display text-sm font-bold tracking-[-.02em]">{settings.websiteName}</Link>
        <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">Live</span>
      </header>

      <main className={cn("transition-[padding] duration-200", compact ? "md:pl-[88px]" : "md:pl-64")}>{children}</main>

      <nav className="mobile-only fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-[#0a0c0f]/95 px-1 pb-[max(8px,var(--safe-bottom))] pt-2 backdrop-blur-xl">
        {nav.map(({ href, mobileEn, mobileZh, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium text-zinc-600", active && "text-white")}><Icon size={20} className={cn(active && "text-acid")} /><span>{text(mobileEn, mobileZh)}</span></Link>;
        })}
      </nav>
    </div>
  );
}
