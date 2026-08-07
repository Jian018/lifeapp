"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, dateInTimezone, formatLongDate, formatShortDate } from "@/lib/date";
import { useApi, apiRequest } from "@/hooks/use-api";
import { useAdmin } from "@/components/admin-gate";
import { ErrorState } from "@/components/error-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Check, ChevronLeft, ChevronRight, CircleDashed, Clock3, CornerDownRight, Flame, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { ActivityEntry, DailyTaskRecord, TaskDefinition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/components/app-settings";
import { ActivityEntryDialog } from "@/components/activity-entry-dialog";

type TaskData = {
  date: string;
  today: string;
  isFuture: boolean;
  tasks: Array<{ definition: TaskDefinition; record: DailyTaskRecord }>;
  activities: ActivityEntry[];
  activityBurn: number;
  summary: { total: number; completed: number; pending: number; carried: number; completionRate: number; incompleteRate: number };
  calendar: Array<{ date: string; state: "complete" | "partial" | "warning" | "empty" }>;
};

const stateDot = { complete: "bg-emerald-400", partial: "bg-amber-400", warning: "bg-coral", empty: "bg-zinc-700" };

export default function TasksPage() {
  const { settings, text } = useAppSettings();
  const [date, setDate] = useState(dateInTimezone(new Date(), settings.timezone));
  const url = useMemo(() => `/api/public/tasks?date=${date}`, [date]);
  const { data, loading, error, refetch } = useApi<TaskData>(url);
  const { requireAdmin } = useAdmin();
  const [activityOpen, setActivityOpen] = useState(false);

  const mutate = (route: string, taskDefinitionId: string, success: string, confirm?: string) => requireAdmin(async () => {
    if (confirm && !window.confirm(confirm)) return;
    try { await apiRequest(route, "POST", { taskDefinitionId, date }); toast.success(success); await refetch(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Update failed."); }
  });

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error || "Tasks unavailable."} retry={() => void refetch()} />;

  return (
    <div className="page-wrap">
      <header className="mb-7 flex flex-col gap-4 md:mb-9 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow mb-3">{text("Daily movement card", "每日运动卡")}</p><h1 className="display-title">{text("Today’s Tasks", "今日任务")}</h1></div><Button variant="secondary" size="sm" onClick={() => setDate(data.today)} disabled={date === data.today}>{text("Return to today", "返回今天")}</Button></header>

      <section className="panel mb-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3 py-3 md:px-5"><button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronLeft /></button><div className="text-center"><p className="font-display text-sm font-bold md:text-base">{formatLongDate(date)}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.16em] text-acid">{date === data.today ? "Today" : data.isFuture ? "Planned" : "History"}</p></div><button aria-label="Next day" onClick={() => setDate(addDays(date, 1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronRight /></button></div>
        <div className="scrollbar-none flex snap-x gap-2 overflow-x-auto px-3 py-3 md:grid md:px-5" style={{ gridTemplateColumns: `repeat(${data.calendar.length}, minmax(0, 1fr))` }}>
          {data.calendar.map((item) => <button key={item.date} onClick={() => setDate(item.date)} className={cn("min-w-[58px] snap-center rounded-xl border px-2 py-2.5 text-center transition-colors", item.date === date ? "border-acid/50 bg-acid/[.08]" : "border-transparent hover:bg-white/[.04]")}><span className="block text-[10px] uppercase text-zinc-600">{new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${item.date}T00:00:00Z`))}</span><span className="mt-1 block font-display text-sm font-bold">{formatShortDate(item.date).split(" ")[0]}</span><span className={cn("mx-auto mt-2 block h-1.5 w-1.5 rounded-full", stateDot[item.state])} /></button>)}
        </div>
      </section>

      <section className="mb-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
        <div className="bg-panel p-4 md:col-span-2 md:p-5"><p className="eyebrow">Completion</p><div className="mt-2 flex items-end gap-2"><span className="metric">{data.summary.completionRate}%</span><span className="mb-1.5 text-xs text-zinc-500">{data.summary.completed}/{data.summary.total}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-acid transition-[width] duration-200" style={{ width: `${data.summary.completionRate}%` }} /></div></div>
        {[{ label: "Complete", value: data.summary.completed, color: "text-emerald-400" }, { label: "Open", value: data.summary.pending, color: "text-white" }, { label: "Carried", value: data.summary.carried, color: "text-coral" }].map((metric) => <div key={metric.label} className="bg-panel p-4 md:p-5"><p className="eyebrow">{metric.label}</p><p className={cn("mt-3 font-display text-3xl font-bold", metric.color)}>{metric.value}</p></div>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.tasks.map(({ definition, record }, index) => {
          const completed = record.status === "completed"; const carried = record.status === "carried";
          return <Card key={definition.id} className={cn("p-5 md:p-6", completed && "border-emerald-500/30", carried && "border-coral/30")}><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold", completed ? "bg-emerald-400 text-ink" : carried ? "bg-coral/10 text-coral" : "bg-white/[.05] text-zinc-400")}>{completed ? <Check size={19} /> : carried ? <CornerDownRight size={18} /> : `0${index + 1}`}</span><div><h2 className="font-display text-lg font-bold tracking-[-.03em]">{definition.name}</h2><p className={cn("mt-1 text-xs font-semibold uppercase tracking-[.12em]", completed ? "text-emerald-400" : carried ? "text-coral" : "text-zinc-600")}>{completed ? "Completed" : carried ? `Carried to ${formatShortDate(record.carriedToDate!)}` : data.isFuture ? "Planned" : "Ready"}</p></div></div><div className="text-right"><span className="font-display text-3xl font-bold tracking-[-.05em]">{record.totalTarget}</span><span className="ml-1 text-xs text-zinc-500">{definition.unit}</span></div></div>
            <div className="my-5 grid grid-cols-3 gap-2 rounded-xl bg-[#0b0d10] p-3 text-center"><div><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">Base</p><p className="mt-1 text-sm font-semibold">{record.baseTarget}</p></div><div className="border-x border-line"><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">Carried in</p><p className={cn("mt-1 text-sm font-semibold", record.carriedTarget > 0 && "text-coral")}>+{record.carriedTarget}</p></div><div><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">Total</p><p className="mt-1 text-sm font-semibold text-acid">{record.totalTarget}</p></div></div>
            <div className="grid grid-cols-2 gap-2">{completed ? <Button className="col-span-2" variant="secondary" onClick={() => void mutate("/api/tasks/uncomplete", definition.id, "Completion removed.")}><RotateCcw size={16} />Undo completion</Button> : carried ? <Button className="col-span-2" variant="secondary" onClick={() => void mutate("/api/tasks/revert-carry", definition.id, "Carryover reverted.")}><RotateCcw size={16} />Revert carryover</Button> : <><Button onClick={() => void mutate("/api/tasks/complete", definition.id, "Task completed.")} disabled={data.isFuture}><Check size={16} />Complete</Button><Button variant="secondary" onClick={() => void mutate("/api/tasks/carry", definition.id, "Full target moved to tomorrow.", "Move today’s full unfinished target into tomorrow?")} disabled={data.isFuture}><Clock3 size={16} />Carry forward</Button></>}</div>
          </Card>;
        })}
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-[1.45fr_.75fr]">
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Extra Activities</p><h2 className="mt-2 font-display text-xl font-bold">Completed movement</h2></div><Button size="sm" onClick={() => void requireAdmin(() => setActivityOpen(true))} disabled={data.isFuture}><Plus size={16} />Add Task</Button></div>
          {data.activities.length ? <div className="mt-4 divide-y divide-line">{data.activities.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky/10 text-sky"><Activity size={18} /></span><div><p className="font-display font-bold">{entry.activityName}</p><p className="mt-1 text-xs text-zinc-500">{entry.durationMinutes} minutes · {entry.intensity} · completed</p></div></div><div className="text-right"><p className="font-display text-lg font-bold">{entry.confirmedCaloriesBurned.toLocaleString()}</p><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">kcal burned</p></div></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-zinc-600">No extra activities recorded for this date.</div>}
          <p className="mt-4 text-xs leading-5 text-zinc-600">Extra activities are stored as completed exercise and never change the four-task completion reward.</p>
        </Card>
        <Link href={`/calories?date=${date}&view=activities`} className="group"><Card className="flex h-full min-h-48 flex-col p-5 transition-colors group-hover:border-sky/40 md:p-6"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky/10 text-sky"><Flame size={18} /></span><ChevronRight className="text-zinc-600 transition-transform group-hover:translate-x-1" /></div><div className="mt-auto pt-8"><p className="eyebrow">Today Activity Burn</p><p className="mt-2 font-display text-4xl font-bold">{data.activityBurn.toLocaleString()} <span className="text-sm text-zinc-600">kcal</span></p><p className="mt-2 text-xs text-zinc-600">Open Calories activities</p></div></Card></Link>
      </section>
      {data.isFuture && <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-white/[.02] p-4 text-sm text-zinc-500"><CircleDashed size={17} /> Future dates are view-only. Come back on the day to complete or carry tasks.</div>}
      <ActivityEntryDialog key={`${date}-${activityOpen}`} open={activityOpen} onOpenChange={setActivityOpen} selectedDate={date} onSaved={refetch} />
    </div>
  );
}
