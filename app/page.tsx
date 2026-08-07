"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck, Flame, HeartPulse, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { formatLongDate } from "@/lib/date";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/components/app-settings";

type Dashboard = {
  today: string;
  tasks: { total: number; completed: number; pending: number; carried: number; completionRate: number };
  lifecycle: { remainingDays: number; naturalDaysRemaining: number; effectiveDaysRemaining: number; energized: number; stage: { emoji: string; label: string } };
  calories: { total: number; intake: number; burned: number; net: number; meals: number; desserts: number };
};

export default function HomePage() {
  const router = useRouter();
  const { settings, ready, text } = useAppSettings();
  const { data, loading, error, refetch } = useApi<Dashboard>("/api/public/dashboard");
  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get("pwa") === "1" && settings.defaultLandingPage !== "/") router.replace(settings.defaultLandingPage);
  }, [ready, router, settings.defaultLandingPage]);
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error || "Dashboard unavailable."} retry={() => void refetch()} />;

  return (
    <div className="page-wrap">
      <header className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div><p className="eyebrow mb-3">{formatLongDate(data.today)}</p><h1 className="display-title">{text("Run your day.", "经营今天。")}<br /><span className="text-zinc-600">{text("Shape your life.", "塑造人生。")}</span></h1></div>
        <div className="flex items-center gap-2 self-start rounded-full border border-acid/20 bg-acid/[.06] px-3 py-2 text-xs font-semibold text-acid"><Sparkles size={14} /> {text("Your system is live", "系统运行中")}</div>
      </header>

      <section className="mb-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
        <div className="bg-panel p-5 md:p-7"><p className="eyebrow">Tasks complete</p><div className="mt-3 flex items-end gap-2"><span className="metric">{data.tasks.completionRate}</span><span className="mb-1 text-xl font-semibold text-acid">%</span></div><p className="mt-2 text-xs text-zinc-500">{data.tasks.completed} of {data.tasks.total} movements</p></div>
        <div className="bg-panel p-5 md:p-7"><p className="eyebrow">ENERGIZED</p><div className="mt-3 flex items-end gap-3"><span className="metric">{data.lifecycle.energized}%</span><span className="mb-1 text-3xl">{data.lifecycle.stage.emoji}</span></div><p className="mt-2 text-xs text-zinc-500">Natural {data.lifecycle.naturalDaysRemaining.toLocaleString()} · Effective <span className="text-acid">{data.lifecycle.effectiveDaysRemaining.toLocaleString()}</span> days</p></div>
        <Link href={`/calories?date=${data.today}`} className="bg-panel p-5 transition-colors hover:bg-white/[.025] md:p-7"><p className="eyebrow">Calories today</p><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">Intake</p><p className="mt-1 font-display text-2xl font-bold">{data.calories.intake.toLocaleString()}</p></div><div><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">Burned</p><p className="mt-1 font-display text-2xl font-bold text-sky">{data.calories.burned.toLocaleString()}</p></div></div><p className="mt-4 text-xs text-zinc-500">Net <span className="font-semibold text-white">{data.calories.net.toLocaleString()} kcal</span> · open details</p></Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { key: "tasks", href: "/tasks", label: text("Movement", "运动"), title: text("Today’s Tasks", "今日任务"), description: text("Finish the foundations. Carry what matters, never lose the thread.", "完成基础运动，把未完成目标延续到明天。"), icon: CalendarCheck, accent: "acid" },
          { key: "lifecycle", href: "/lifecycle", label: text("Direction", "方向"), title: text("Lifecycle", "生命周期"), description: text("See time clearly and keep three life directions in honest balance.", "看清时间，并管理三个真实的生活方向。"), icon: HeartPulse, accent: "coral" },
          { key: "calories", href: `/calories?date=${data.today}`, label: text("Intake & Burn", "摄取与消耗"), title: text("Calorie Log", "卡路里记录"), description: text("Track intake, completed activity burn and net calories by date.", "按日期记录摄取、运动消耗与净卡路里。"), icon: Flame, accent: "sky" },
        ].map(({ key, href, label, title, description, icon: Icon, accent }, index) => {
          const accentClass = accent === "acid" ? "text-acid bg-acid/10" : accent === "coral" ? "text-coral bg-coral/10" : "text-sky bg-sky/10";
          const stat = key === "tasks" ? `${data.tasks.pending} OPEN` : key === "lifecycle" ? `${data.lifecycle.energized}%` : `${data.calories.meals} LOGGED`;
          return <Link href={href} key={href} className="group"><Card className="relative flex h-full min-h-64 flex-col overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-1 md:p-6"><span className="pointer-events-none absolute right-4 top-1 font-display text-8xl font-bold tracking-[-.09em] text-white/[.025]">0{index + 1}</span><div className="relative flex items-start justify-between"><span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", accentClass)}><Icon size={20} /></span><span className="font-display text-xs font-bold tracking-[.14em] text-zinc-600">{stat}</span></div><div className="relative mt-auto pt-10"><p className="eyebrow mb-2">{label}</p><h2 className="font-display text-xl font-bold tracking-[-.03em]">{title}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">{description}</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-white">Open system <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" /></div></div></Card></Link>;
        })}
      </section>
    </div>
  );
}
