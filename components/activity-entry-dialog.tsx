"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Activity, Edit3, Flame, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/hooks/use-api";
import { timeInTimezone } from "@/lib/date";
import type { ActivityAnalysisResult, ActivityEntry, ActivityIntensity, Confidence } from "@/lib/types";
import { useAppSettings } from "@/components/app-settings";
import { Button } from "@/components/ui/button";

type Draft = {
  activityDate: string;
  activityTime: string;
  activityName: string;
  durationMinutes: number;
  intensity: ActivityIntensity;
  confirmedCaloriesBurned: number;
  aiEstimatedCaloriesBurned: number | null;
  minimumCaloriesBurned: number | null;
  maximumCaloriesBurned: number | null;
  confidence: Confidence | null;
  assumptions: string[];
  source: "ai" | "manual";
};

type AnalysisResponse = {
  result: ActivityAnalysisResult;
  mode: "openai";
  weightMode: "average" | "personalized";
  bodyWeightKg: number | null;
};

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-[#0b0d10] px-3 text-sm text-white outline-none focus:border-acid";

function blankDraft(date: string, timezone: string): Draft {
  return { activityDate: date, activityTime: timeInTimezone(new Date(), timezone), activityName: "", durationMinutes: 30, intensity: "moderate", confirmedCaloriesBurned: 0, aiEstimatedCaloriesBurned: null, minimumCaloriesBurned: null, maximumCaloriesBurned: null, confidence: null, assumptions: [], source: "manual" };
}

function fromEntry(entry: ActivityEntry): Draft {
  return { ...entry };
}

function fromAnalysis(result: ActivityAnalysisResult, date: string, timezone: string): Draft {
  return {
    activityDate: date,
    activityTime: timeInTimezone(new Date(), timezone),
    activityName: result.activity_name,
    durationMinutes: result.duration_minutes,
    intensity: result.intensity,
    confirmedCaloriesBurned: result.estimated_calories_burned,
    aiEstimatedCaloriesBurned: result.estimated_calories_burned,
    minimumCaloriesBurned: result.minimum_calories_burned,
    maximumCaloriesBurned: result.maximum_calories_burned,
    confidence: result.confidence,
    assumptions: result.assumptions,
    source: "ai",
  };
}

export function ActivityEntryDialog({ open, onOpenChange, selectedDate, entry = null, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; selectedDate: string; entry?: ActivityEntry | null; onSaved: () => Promise<void> }) {
  const { settings } = useAppSettings();
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft>(() => entry ? fromEntry(entry) : blankDraft(selectedDate, settings.timezone));
  const [stage, setStage] = useState<"describe" | "form">(entry || !settings.activityAiEnabled ? "form" : "describe");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setBusy(true); setError(null);
    try {
      const response = await apiRequest<AnalysisResponse>("/api/analyze-activity", "POST", { description });
      setAnalysis(response);
      setDraft(fromAnalysis(response.result, selectedDate, settings.timezone));
      setStage("form");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activity analysis failed.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (entry) {
        await apiRequest(`/api/activities/${entry.id}`, "PATCH", {
          activityDate: draft.activityDate,
          activityTime: draft.activityTime,
          activityName: draft.activityName,
          durationMinutes: draft.durationMinutes,
          confirmedCaloriesBurned: draft.confirmedCaloriesBurned,
        });
        toast.success("Activity updated.");
      } else {
        await apiRequest("/api/activities/create", "POST", draft);
        toast.success("Activity added and calories burned updated.");
      }
      onOpenChange(false);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save activity.");
    } finally { setBusy(false); }
  };

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-x-3 top-1/2 z-[80] mx-auto max-h-[92vh] max-w-xl -translate-y-1/2 overflow-y-auto rounded-3xl border border-line bg-panel p-5 shadow-2xl outline-none md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><Dialog.Title className="font-display text-xl font-bold">{entry ? "Edit activity" : "Add activity"}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-zinc-500">Completed exercise only. Burned calories remain an estimate until you confirm them.</Dialog.Description></div>
          <Dialog.Close className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-white/5"><X size={18} /></Dialog.Close>
        </div>

        {stage === "describe" && <div className="mt-6">
          <label><span className="mb-2 block text-sm font-semibold">What did you do?</span><textarea autoFocus className={`${inputClass} min-h-28 resize-none py-3`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="30分钟 basketball or Cycling 20 minutes" /></label>
          {error && <p role="alert" className="mt-3 rounded-xl bg-coral/10 p-3 text-sm text-coral">{error}</p>}
          <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => { setStage("form"); setDraft(blankDraft(selectedDate, settings.timezone)); }}><Edit3 size={16} />Manual entry</Button><Button disabled={busy || description.trim().length < 2} onClick={() => void analyze()}><Sparkles size={16} />{busy ? "Estimating activity…" : "Analyze with AI"}</Button></div>
        </div>}

        {stage === "form" && <div className="mt-6 space-y-4">
          {analysis && <div className="rounded-2xl border border-acid/20 bg-acid/[.05] p-4"><div className="flex items-center gap-2 text-acid"><Sparkles size={16} /><span className="text-xs font-bold uppercase tracking-[.12em]">OpenAI estimate</span></div><p className="mt-2 text-xs text-zinc-500">{analysis.weightMode === "personalized" ? `Personalized using ${analysis.bodyWeightKg}kg` : "Using average adult estimate"}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs text-zinc-500">Activity Name</span><input className={inputClass} value={draft.activityName} onChange={(event) => setDraft({ ...draft, activityName: event.target.value })} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Duration (minutes)</span><input type="number" min="1" max="1440" className={inputClass} value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Date</span><input type="date" className={inputClass} value={draft.activityDate} onChange={(event) => setDraft({ ...draft, activityDate: event.target.value })} /></label><label><span className="mb-1.5 block text-xs text-zinc-500">Time</span><input type="time" className={inputClass} value={draft.activityTime} onChange={(event) => setDraft({ ...draft, activityTime: event.target.value })} /></label></div>
          <label><span className="mb-1.5 block text-xs text-zinc-500">Calories Burned</span><input type="number" min="0" max="20000" className={inputClass} value={draft.confirmedCaloriesBurned} onChange={(event) => setDraft({ ...draft, confirmedCaloriesBurned: Number(event.target.value) })} /></label>
          {analysis && <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-line"><div className="bg-[#0b0d10] p-3 text-center"><p className="text-[10px] text-zinc-600">Range Low</p><p className="mt-1 font-semibold">{draft.minimumCaloriesBurned}</p></div><div className="bg-[#0b0d10] p-3 text-center"><Flame className="mx-auto text-acid" size={16} /><p className="mt-1 font-semibold text-acid">~{draft.confirmedCaloriesBurned} kcal</p></div><div className="bg-[#0b0d10] p-3 text-center"><p className="text-[10px] text-zinc-600">Range High</p><p className="mt-1 font-semibold">{draft.maximumCaloriesBurned}</p></div></div>}
          <div className="rounded-xl bg-white/[.025] p-3 text-xs leading-5 text-zinc-500"><p className="font-semibold text-zinc-300">Estimate only</p><p>Actual burn varies with heart rate, intensity, rest time, body composition and metabolism.</p>{draft.assumptions.map((item) => <p key={item}>• {item}</p>)}</div>
          {error && <p role="alert" className="rounded-xl bg-coral/10 p-3 text-sm text-coral">{error}</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>{!entry && settings.activityAiEnabled && <Button variant="secondary" onClick={() => setStage("describe")}><RefreshCw size={15} />Re-analyze</Button>}<Button className={entry || !settings.activityAiEnabled ? "col-span-1 sm:col-span-3" : "col-span-2"} disabled={busy || !draft.activityName.trim() || draft.durationMinutes <= 0} onClick={() => void save()}><Activity size={16} />{busy ? "Saving…" : entry ? "Save changes" : "Confirm & Add"}</Button></div>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
