"use client";

import { useApi } from "@/hooks/use-api";
import { useAppSettings } from "@/components/app-settings";
import { ErrorState } from "@/components/error-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { CalendarDays, Clock3, Globe2, HeartHandshake, UsersRound } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { LifecycleEffect, SystemSettings } from "@/lib/types";

type LifeData = {
  settings: SystemSettings;
  timeline: { totalDays: number; livedDays: number; remainingDays: number; elapsedPercent: number; remainingPercent: number };
  energized: number;
  stage: { emoji: string; label: string };
  recent: LifecycleEffect[];
};

const stages = [{ at: 0, emoji: "💔" }, { at: 25, emoji: "🙂" }, { at: 50, emoji: "🤩" }, { at: 75, emoji: "🥰" }, { at: 100, emoji: "❤️" }];

export default function LifecyclePage() {
  const { data, loading, error, refetch } = useApi<LifeData>("/api/public/lifecycle");
  const { text } = useAppSettings();
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error || "Lifecycle unavailable."} retry={() => void refetch()} />;

  const dateLabel = (date: string) => new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)).toUpperCase();
  const activityTime = (effect: LifecycleEffect) => new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: data.settings.timezone }).format(new Date(effect.createdAt));
  const categories = [
    { key: "exploreWorldScore" as const, delta: "worldDelta" as const, label: text("EXPLORE WORLD", "探索世界"), icon: Globe2, color: "bg-sky", textColor: "text-sky" },
    { key: "relationshipScore" as const, delta: "relationshipDelta" as const, label: text("RELATIONSHIP", "感情关系"), icon: HeartHandshake, color: "bg-coral", textColor: "text-coral" },
    { key: "familyScore" as const, delta: "familyDelta" as const, label: text("FAMILY", "家人"), icon: UsersRound, color: "bg-acid", textColor: "text-acid" },
  ];

  return <div className="page-wrap">
    <header className="mb-7 md:mb-10"><p className="eyebrow mb-3">{text("Time & direction", "时间与方向")}</p><h1 className="display-title">{text("Lifecycle", "生命周期")}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">{text("The timeline measures time. ENERGIZED measures the sum of your three life directions.", "时间线衡量时间，ENERGIZED 是三个生活方向的实时总和。")}</p></header>

    <section className="mb-5">
      <Card className="overflow-hidden"><div className="border-b border-line p-5 md:p-6"><p className="eyebrow">LIFE TIMELINE</p></div><div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-panel p-5 md:p-6"><CalendarDays size={18} className="mb-5 text-sky" /><p className="eyebrow">Born</p><p className="mt-2 font-display text-lg font-bold">{dateLabel(data.settings.birthDate)}</p></div>
        <div className="bg-panel p-5 md:p-6"><CalendarDays size={18} className="mb-5 text-coral" /><p className="eyebrow">Target</p><p className="mt-2 font-display text-lg font-bold">{dateLabel(data.settings.targetDate)}</p></div>
        <div className="bg-panel p-5 md:p-6"><Clock3 size={18} className="mb-5 text-zinc-500" /><p className="eyebrow">Days Lived</p><p className="mt-2 font-display text-3xl font-bold">{data.timeline.livedDays.toLocaleString()}</p></div>
        <div className="bg-panel p-5 md:p-6"><Clock3 size={18} className="mb-5 text-acid" /><p className="eyebrow">Days Remaining</p><p className="mt-2 font-display text-3xl font-bold">{data.timeline.remainingDays.toLocaleString()}</p></div>
        <div className="bg-panel p-5 md:p-6"><p className="eyebrow">Time Used</p><p className="mt-7 font-display text-3xl font-bold">{formatNumber(data.timeline.elapsedPercent)}%</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-zinc-500" style={{ width: `${Math.min(100, data.timeline.elapsedPercent)}%` }} /></div></div>
      </div></Card>
    </section>

    <section className="mb-5 space-y-4">
      {categories.map(({ key, delta, label, icon: Icon, color, textColor }) => {
        const last = data.recent.find((effect) => effect[delta] !== 0);
        const change = last?.[delta] ?? 0;
        return <Card key={key} className="p-5 md:p-6"><div className="grid gap-6 md:grid-cols-[1fr_1.5fr_.9fr] md:items-center"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[.04] ${textColor}`}><Icon size={20} /></span><div><p className="eyebrow">{label}</p><p className="mt-1 font-display text-4xl font-bold tracking-[-.05em]">{formatNumber(data.settings[key])}%</p></div></div><div><div className="h-3 overflow-hidden rounded-full bg-white/[.06]"><div className={`h-full rounded-full ${color} transition-[width] duration-200`} style={{ width: `${data.settings[key]}%` }} /></div></div><div className="md:text-right"><p className="eyebrow">Last Change</p>{last ? <><p className={`mt-1 text-sm font-semibold ${change >= 0 ? "text-acid" : "text-coral"}`}>{change >= 0 ? "+" : ""}{formatNumber(change)} · {last.reason}</p><p className="mt-1 text-xs text-zinc-600">{activityTime(last)}</p></> : <p className="mt-1 text-sm text-zinc-600">No activity yet</p>}</div></div></Card>;
      })}
    </section>

    <section className="mb-5">
      <Card className="overflow-hidden p-5 md:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">ENERGIZED</p><p className="mt-2 text-xs text-zinc-600">Explore World + Relationship + Family · displayed from 0–100%</p></div><div className="text-right"><span className="text-3xl">{data.stage.emoji}</span><span className="ml-2 font-display text-4xl font-bold tracking-[-.05em]">{formatNumber(data.energized)}%</span></div></div>
        <div className="relative mt-10 pt-8"><span className="absolute top-0 -translate-x-1/2 text-2xl transition-[left] duration-200" style={{ left: `${data.energized}%` }}>{data.stage.emoji}</span><div className="h-4 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-coral via-amber-300 to-acid transition-[width] duration-200" style={{ width: `${data.energized}%` }} /></div><div className="mt-4 flex justify-between">{stages.map((stage) => <div key={stage.at} className="text-center"><span className="block text-base">{stage.emoji}</span><span className="mt-1 block text-[9px] text-zinc-600">{stage.at}</span></div>)}</div></div>
      </Card>
    </section>

    <section><Card className="p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent Activity</p><h2 className="mt-2 font-display text-xl font-bold">Lifecycle ledger</h2></div><span className="text-[10px] uppercase tracking-[.14em] text-zinc-600">Stored deltas never recalculate</span></div>{data.recent.length ? <div className="mt-4 divide-y divide-line">{data.recent.map((effect) => <div key={effect.id} className="grid gap-2 py-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center md:gap-6"><div><p className="text-sm font-medium">{effect.reason}</p><p className="mt-1 text-xs text-zinc-600">{activityTime(effect)} · {effect.sourceType.replaceAll("_", " ")}</p></div><span className={effect.worldDelta >= 0 ? "text-acid" : "text-coral"}>World {effect.worldDelta >= 0 ? "+" : ""}{formatNumber(effect.worldDelta)}</span><span className={effect.relationshipDelta >= 0 ? "text-acid" : "text-coral"}>Relationship {effect.relationshipDelta >= 0 ? "+" : ""}{formatNumber(effect.relationshipDelta)}</span><span className={effect.familyDelta >= 0 ? "text-acid" : "text-coral"}>Family {effect.familyDelta >= 0 ? "+" : ""}{formatNumber(effect.familyDelta)}</span></div>)}</div> : <div className="flex min-h-40 items-center justify-center text-sm text-zinc-600">No lifecycle activity yet.</div>}</Card></section>
  </div>;
}
