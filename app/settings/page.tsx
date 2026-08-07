"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest, useApi } from "@/hooks/use-api";
import { useAdmin } from "@/components/admin-gate";
import { useAppSettings } from "@/components/app-settings";
import { ErrorState } from "@/components/error-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink, HardDrive, KeyRound, Lock, RotateCcw, Save, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import type { SystemSettings, TaskDefinition } from "@/lib/types";
import { energizedScore, heartStage } from "@/lib/lifecycle";
import { targetDateFromAge } from "@/lib/date";
import { toast } from "sonner";

type SettingsData = { settings: SystemSettings; taskDefinitions: TaskDefinition[] };
type SectionKey = "general" | "timeline" | "lifecycle" | "tasks" | "rules" | "calories" | "display" | "reset";
type CsvDataset = "tasks" | "food" | "activities" | "lifecycle" | "smoking";
const inputClass = "min-h-11 w-full rounded-xl border border-line bg-[#0b0d10] px-3 text-sm text-white outline-none transition-colors focus:border-acid disabled:cursor-not-allowed disabled:opacity-50";

function sameFields<T extends object>(current: T, saved: T, fields: Array<keyof T>) { return fields.every((field) => current[field] === saved[field]); }

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-line bg-[#0b0d10] px-4 text-left"><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-zinc-600">{description}</span></span><span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-acid" : "bg-zinc-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></span></button>;
}

function SectionHeader({ eyebrow, title, dirty, saving, save, disabled = false }: { eyebrow: string; title: string; dirty: boolean; saving: boolean; save: () => void; disabled?: boolean }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{eyebrow}</p><div className="mt-2 flex items-center gap-3"><h2 className="font-display text-xl font-bold">{title}</h2>{dirty && <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-amber-300">Unsaved Changes</span>}</div></div><Button size="sm" disabled={!dirty || saving || disabled} onClick={save}><Save size={15} />{saving ? "Saving…" : "Save"}</Button></div>;
}

export default function SettingsPage() {
  const { data, loading, error, refetch } = useApi<SettingsData>("/api/settings");
  const { requireAdmin, session, lock } = useAdmin();
  const { refreshSettings, text } = useAppSettings();
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDefinition[] | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [csvDataset, setCsvDataset] = useState<CsvDataset>("food");

  if (loading || !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} retry={() => void refetch()} />;

  const settings = draft ?? data.settings;
  const tasks = taskDraft ?? data.taskDefinitions;
  const change = <K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) => setDraft({ ...settings, [field]: value });
  const dirty = {
    general: !sameFields(settings, data.settings, ["websiteName", "language", "timezone"]),
    timeline: !sameFields(settings, data.settings, ["birthDate", "targetAge"]),
    lifecycle: !sameFields(settings, data.settings, ["exploreWorldScore", "relationshipScore", "familyScore"]),
    rules: !sameFields(settings, data.settings, ["exerciseWorldDelta", "exerciseRelationshipDelta", "exerciseFamilyDelta", "dessertWorldDelta", "dessertRelationshipDelta", "dessertFamilyDelta", "smokingWorldDelta", "smokingRelationshipDelta", "smokingFamilyDelta"]),
    calories: !sameFields(settings, data.settings, ["defaultMealType", "aiFoodAnalysisEnabled", "activityAiEnabled", "bodyWeightKg", "defaultCaloriesView", "requireAiConfirmation"]),
    display: !sameFields(settings, data.settings, ["defaultLandingPage", "desktopSidebarMode", "mobileDateRange"]),
    tasks: JSON.stringify(tasks) !== JSON.stringify(data.taskDefinitions),
  };
  const preview = energizedScore(settings);
  const previewStage = heartStage(preview);

  const saveSection = (section: SectionKey, url: string, payload: unknown) => requireAdmin(async () => {
    setSaving(section);
    try {
      await apiRequest(url, "PATCH", payload);
      await Promise.all([refetch(), refreshSettings()]);
      toast.success("Settings saved successfully.");
      if (section === "lifecycle") setReason("");
    } catch {
      toast.error("Unable to save settings. Your previous settings were not changed.");
    } finally { setSaving(null); }
  });

  const exportData = async (format: "json" | "csv") => {
    try {
      const response = await fetch("/api/settings/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, dataset: format === "json" ? "all" : csvDataset }) });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename=([^;]+)/)?.[1] ?? `my-life-system.${format}`;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
      toast.success("Export created.");
    } catch { toast.error("Unable to create export."); }
  };

  const resetLifecycle = () => requireAdmin(async () => {
    if (!window.confirm("Reset only the three Lifecycle scores to 33 / 33 / 33? Task, food and smoking history will be kept.")) return;
    const confirmation = window.prompt("Type RESET LIFECYCLE to continue:");
    if (confirmation !== "RESET LIFECYCLE") { toast.error("Confirmation text did not match."); return; }
    setSaving("reset");
    try { await apiRequest("/api/settings/reset-lifecycle", "POST", { confirmation }); await Promise.all([refetch(), refreshSettings()]); setDraft(null); toast.success("Lifecycle reset to 33 / 33 / 33."); }
    catch { toast.error("Unable to reset Lifecycle. Your previous settings were not changed."); }
    finally { setSaving(null); }
  });

  const resetEverything = () => requireAdmin(async () => {
    if (!window.confirm("DANGER: This will permanently clear every task, carryover, meal, smoking record and lifecycle event.")) return;
    const confirmation = window.prompt("Type RESET EVERYTHING to continue:");
    if (confirmation !== "RESET EVERYTHING") { toast.error("Confirmation text did not match."); return; }
    if (!window.confirm("Final confirmation: permanently reset the entire system?")) return;
    setSaving("reset");
    try { await apiRequest("/api/settings/reset-all", "POST", { confirmation }); await Promise.all([refetch(), refreshSettings()]); setDraft(null); setTaskDraft(null); toast.success("Entire system reset."); }
    catch { toast.error("Unable to reset the system. Your previous data was not changed."); }
    finally { setSaving(null); }
  });

  const remaining = session.authorized ? Math.max(0, Math.ceil(session.remainingSeconds / 60)) : 0;
  return <div className="page-wrap">
    <header className="mb-7 md:mb-10"><p className="eyebrow mb-3">{text("System controls", "系统控制")}</p><h1 className="display-title">{text("Settings", "设置")}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">{text("Every visible control is connected to the server datastore and protected by the management code.", "页面上的每个设置都连接到服务端数据，并受管理码保护。")}</p></header>

    <div className="mb-5 grid gap-4 md:grid-cols-3">
      <Card className="p-5"><div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${session.authorized ? "bg-acid/10 text-acid" : "bg-white/[.05] text-zinc-500"}`}>{session.authorized ? <ShieldCheck size={19} /> : <KeyRound size={19} />}</span><span className="eyebrow">{session.authorized ? `Unlocked · ${remaining}m` : "Locked"}</span></div><p className="mt-4 text-sm text-zinc-500">Refresh locks management immediately.</p>{session.authorized && <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => void lock()}><Lock size={14} />Lock now</Button>}</Card>
      <Card className="p-5"><Smartphone size={19} className="text-sky" /><p className="mt-4 font-display font-bold">{settings.websiteName}</p><Link href="/install" className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">Open install page <ExternalLink size={14} /></Link></Card>
      <Card className="p-5"><HardDrive size={19} className="text-acid" /><p className="mt-4 font-display font-bold">Persistent datastore</p><p className="mt-2 text-xs leading-5 text-zinc-600">Hosted saves use Supabase; localhost keeps the same behavior through its server-side development datastore.</p></Card>
    </div>

    <div className="space-y-5">
      <Card className="p-5 md:p-6"><SectionHeader eyebrow="General" title="Identity & business time" dirty={dirty.general} saving={saving === "general"} save={() => void saveSection("general", "/api/settings/general", { websiteName: settings.websiteName, language: settings.language, timezone: settings.timezone })} /><div className="grid gap-4 md:grid-cols-3"><label><span className="mb-1.5 block text-xs text-zinc-500">Website Name</span><input className={inputClass} value={settings.websiteName} onChange={(e) => change("websiteName", e.target.value)} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Language</span><select className={inputClass} value={settings.language} onChange={(e) => change("language", e.target.value as SystemSettings["language"])}><option value="en">English</option><option value="zh">中文</option></select></label><label><span className="mb-1.5 block text-xs text-zinc-500">Timezone</span><select className={inputClass} value={settings.timezone} onChange={(e) => change("timezone", e.target.value)}>{["Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "UTC", "Europe/London", "America/New_York"].map((zone) => <option key={zone}>{zone}</option>)}</select></label></div></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Life Timeline" title="Birth date & target age" dirty={dirty.timeline} saving={saving === "timeline"} save={() => void saveSection("timeline", "/api/settings/timeline", { birthDate: settings.birthDate, targetAge: settings.targetAge })} /><div className="grid gap-4 md:grid-cols-3"><label><span className="mb-1.5 block text-xs text-zinc-500">Birth Date</span><input type="date" className={inputClass} value={settings.birthDate} onChange={(e) => change("birthDate", e.target.value)} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Target Age</span><input type="number" min="1" max="120" className={inputClass} value={settings.targetAge} onChange={(e) => change("targetAge", Number(e.target.value))} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Target Date · automatic</span><input readOnly className={inputClass} value={targetDateFromAge(settings.birthDate, settings.targetAge)} /></label></div></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Lifecycle" title="Three life directions" dirty={dirty.lifecycle} saving={saving === "lifecycle"} disabled={reason.trim().length < 3} save={() => void saveSection("lifecycle", "/api/settings/lifecycle", { exploreWorldScore: settings.exploreWorldScore, relationshipScore: settings.relationshipScore, familyScore: settings.familyScore, reason })} /><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div className="space-y-3">{([['exploreWorldScore', 'Explore World'], ['relationshipScore', 'Relationship'], ['familyScore', 'Family']] as const).map(([field, label]) => <label key={field} className="grid grid-cols-[1fr_110px] items-center gap-3"><span className="text-sm text-zinc-400">{label}</span><input type="number" min="0" max="100" step="0.5" className={inputClass} value={settings[field]} onChange={(e) => change(field, Number(e.target.value))} /></label>)}<label className="block pt-2"><span className="mb-1.5 block text-xs text-zinc-500">Reason · required for score changes</span><input className={inputClass} placeholder="Why are these scores changing?" value={reason} onChange={(e) => setReason(e.target.value)} /></label></div><div className="rounded-2xl border border-line bg-[#0b0d10] p-5"><p className="eyebrow">ENERGIZED PREVIEW</p><div className="mt-5 flex items-end justify-between"><span className="text-4xl">{previewStage.emoji}</span><span className="font-display text-5xl font-bold tracking-[-.06em]">{preview}%</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-acid" style={{ width: `${preview}%` }} /></div><div className="mt-4 grid grid-cols-3 text-center text-xs text-zinc-500"><span>World {settings.exploreWorldScore}</span><span>Relationship {settings.relationshipScore}</span><span>Family {settings.familyScore}</span></div></div></div></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Daily Tasks" title="Movement foundations" dirty={dirty.tasks} saving={saving === "tasks"} save={() => void saveSection("tasks", "/api/settings/tasks", { tasks })} /><div className="divide-y divide-line">{tasks.map((task, index) => <div key={task.id} className="py-5 first:pt-0 last:pb-0"><div className="mb-3 flex items-center justify-between"><span className="font-display text-sm font-bold">0{index + 1}</span><Toggle checked={task.isActive} onChange={(value) => setTaskDraft(tasks.map((item) => item.id === task.id ? { ...item, isActive: value } : item))} label={task.isActive ? "Active" : "Disabled"} description="Controls whether this task appears on new daily plans." /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_.7fr_.8fr_.5fr]"><input aria-label="Task name" className={inputClass} value={task.name} onChange={(e) => setTaskDraft(tasks.map((item) => item.id === task.id ? { ...item, name: e.target.value } : item))} /><input aria-label="Base target" type="number" min="0.01" className={inputClass} value={task.baseTarget} onChange={(e) => setTaskDraft(tasks.map((item) => item.id === task.id ? { ...item, baseTarget: Number(e.target.value) } : item))} /><input aria-label="Unit" className={inputClass} value={task.unit} onChange={(e) => setTaskDraft(tasks.map((item) => item.id === task.id ? { ...item, unit: e.target.value } : item))} /><input aria-label="Display order" type="number" min="0" className={inputClass} value={task.displayOrder} onChange={(e) => setTaskDraft(tasks.map((item) => item.id === task.id ? { ...item, displayOrder: Number(e.target.value) } : item))} /></div></div>)}</div><p className="mt-5 text-xs leading-5 text-zinc-600">New targets apply when a daily record is first created. Existing records keep their stored base target.</p></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Lifecycle Rules" title="Deltas for new behavior" dirty={dirty.rules} saving={saving === "rules"} save={() => void saveSection("rules", "/api/settings/lifecycle-rules", { exerciseWorldDelta: settings.exerciseWorldDelta, exerciseRelationshipDelta: settings.exerciseRelationshipDelta, exerciseFamilyDelta: settings.exerciseFamilyDelta, dessertWorldDelta: settings.dessertWorldDelta, dessertRelationshipDelta: settings.dessertRelationshipDelta, dessertFamilyDelta: settings.dessertFamilyDelta, smokingWorldDelta: settings.smokingWorldDelta, smokingRelationshipDelta: settings.smokingRelationshipDelta, smokingFamilyDelta: settings.smokingFamilyDelta })} /><div className="space-y-4">{[
        { label: "Complete All Daily Tasks", fields: ["exerciseWorldDelta", "exerciseRelationshipDelta", "exerciseFamilyDelta"] as const },
        { label: "Dessert", fields: ["dessertWorldDelta", "dessertRelationshipDelta", "dessertFamilyDelta"] as const },
        { label: "Smoking", fields: ["smokingWorldDelta", "smokingRelationshipDelta", "smokingFamilyDelta"] as const },
      ].map((rule) => <div key={rule.label} className="rounded-2xl border border-line p-4"><p className="mb-3 text-sm font-semibold">{rule.label}</p><div className="grid grid-cols-3 gap-3">{rule.fields.map((field, index) => <label key={field}><span className="mb-1.5 block text-[10px] uppercase tracking-[.1em] text-zinc-600">{["World", "Relationship", "Family"][index]}</span><input type="number" step="0.5" min="-100" max="100" className={inputClass} value={settings[field]} onChange={(e) => change(field, Number(e.target.value))} /></label>)}</div></div>)}</div><p className="mt-4 text-xs text-zinc-600">Only new behavior uses changed rules. Existing ledger entries retain the exact deltas originally applied.</p></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Calories" title="Food & exercise estimation" dirty={dirty.calories} saving={saving === "calories"} save={() => void saveSection("calories", "/api/settings/calories", { defaultMealType: settings.defaultMealType, aiFoodAnalysisEnabled: settings.aiFoodAnalysisEnabled, activityAiEnabled: settings.activityAiEnabled, bodyWeightKg: settings.bodyWeightKg, defaultCaloriesView: settings.defaultCaloriesView, requireAiConfirmation: settings.requireAiConfirmation })} /><div className="grid gap-4 lg:grid-cols-3"><label><span className="mb-1.5 block text-xs text-zinc-500">Default Meal Type</span><select className={inputClass} value={settings.defaultMealType} onChange={(e) => change("defaultMealType", e.target.value as SystemSettings["defaultMealType"])}><option value="auto">Auto Detect</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label><label><span className="mb-1.5 block text-xs text-zinc-500">Body Weight (kg)</span><input type="number" min="25" max="350" step="0.1" className={inputClass} value={settings.bodyWeightKg ?? ""} placeholder="Average adult" onChange={(e) => change("bodyWeightKg", e.target.value === "" ? null : Number(e.target.value))} /><span className="mt-1.5 block text-xs text-zinc-600">{settings.bodyWeightKg === null ? "Using average adult estimate" : `Personalized using ${settings.bodyWeightKg}kg`}</span></label><label><span className="mb-1.5 block text-xs text-zinc-500">Default Calories View</span><select className={inputClass} value={settings.defaultCaloriesView} onChange={(e) => change("defaultCaloriesView", e.target.value as SystemSettings["defaultCaloriesView"])}><option value="today">Today</option><option value="week">Week</option><option value="month">Month</option></select></label><Toggle checked={settings.aiFoodAnalysisEnabled} onChange={(value) => change("aiFoodAnalysisEnabled", value)} label="Food AI Analysis" description="Controls the food-photo analysis UI and API." /><Toggle checked={settings.activityAiEnabled} onChange={(value) => change("activityAiEnabled", value)} label="Activity AI Analysis" description="When off, Add Task remains available as manual entry only." /><Toggle checked={settings.requireAiConfirmation} onChange={(value) => change("requireAiConfirmation", value)} label="Require Food AI Confirmation" description="When off, a valid food result is saved immediately." /></div></Card>

      <Card className="p-5 md:p-6"><SectionHeader eyebrow="Display" title="Navigation & density" dirty={dirty.display} saving={saving === "display"} save={() => void saveSection("display", "/api/settings/display", { defaultLandingPage: settings.defaultLandingPage, desktopSidebarMode: settings.desktopSidebarMode, mobileDateRange: settings.mobileDateRange })} /><div className="grid gap-4 md:grid-cols-3"><label><span className="mb-1.5 block text-xs text-zinc-500">Default Landing Page</span><select className={inputClass} value={settings.defaultLandingPage} onChange={(e) => change("defaultLandingPage", e.target.value as SystemSettings["defaultLandingPage"])}><option value="/">Home</option><option value="/tasks">Daily Tasks</option><option value="/lifecycle">Lifecycle</option><option value="/calories">Calories</option></select></label><label><span className="mb-1.5 block text-xs text-zinc-500">Desktop Sidebar</span><select className={inputClass} value={settings.desktopSidebarMode} onChange={(e) => change("desktopSidebarMode", e.target.value as SystemSettings["desktopSidebarMode"])}><option value="expanded">Expanded</option><option value="compact">Compact</option></select></label><label><span className="mb-1.5 block text-xs text-zinc-500">Mobile Date Range</span><select className={inputClass} value={settings.mobileDateRange} onChange={(e) => change("mobileDateRange", Number(e.target.value) as 5 | 7)}><option value="5">5 Days</option><option value="7">7 Days</option></select></label></div></Card>

      <Card className="p-5 md:p-6"><div className="mb-6"><p className="eyebrow">Data Management</p><h2 className="mt-2 font-display text-xl font-bold">Export & protected resets</h2></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-line p-4"><p className="text-sm font-semibold">Export complete JSON</p><p className="mt-1 text-xs leading-5 text-zinc-600">Tasks, activities, carryovers, settings, Lifecycle, food, smoking and effect history.</p><Button className="mt-4 w-full" variant="secondary" onClick={() => void exportData("json")}><Download size={15} />Export JSON</Button></div><div className="rounded-2xl border border-line p-4"><p className="text-sm font-semibold">Export CSV</p><select className={`${inputClass} mt-3`} value={csvDataset} onChange={(e) => setCsvDataset(e.target.value as CsvDataset)}><option value="tasks">Tasks</option><option value="food">Food Entries</option><option value="activities">Activity Entries</option><option value="lifecycle">Lifecycle History</option><option value="smoking">Smoking History</option></select><Button className="mt-3 w-full" variant="secondary" onClick={() => void exportData("csv")}><Download size={15} />Export selected CSV</Button></div></div><div className="mt-5 grid gap-3 border-t border-line pt-5 md:grid-cols-2"><Button variant="danger" disabled={saving === "reset"} onClick={() => void resetLifecycle()}><RotateCcw size={16} />Reset Lifecycle only</Button><Button variant="danger" disabled={saving === "reset"} onClick={() => void resetEverything()}><Trash2 size={16} />Reset entire system</Button></div></Card>
    </div>
  </div>;
}
