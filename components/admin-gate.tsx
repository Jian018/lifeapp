"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Session = { authorized: boolean; expiresAt: number | null; remainingSeconds: number };
type AdminContextValue = {
  requireAdmin: (action: () => void | Promise<void>) => Promise<void>;
  session: Session;
  refreshSession: () => Promise<Session>;
  lock: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminProvider");
  return value;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ authorized: false, expiresAt: null, remainingSeconds: 0 });
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const pending = useRef<(() => void | Promise<void>) | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const unlockedThisPage = useRef(false);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = await response.json() as Session;
      setSession(data); return data;
    } catch { const none = { authorized: false, expiresAt: null, remainingSeconds: 0 }; setSession(none); return none; }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { method: "DELETE" })
      .then(() => { if (active) setSession({ authorized: false, expiresAt: null, remainingSeconds: 0 }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!retryAfter) return;
    const timer = window.setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  const requireAdmin = useCallback(async (action: () => void | Promise<void>) => {
    if (unlockedThisPage.current && session.authorized) { await action(); return; }
    pending.current = action; setDigits(["", "", "", ""]); setError(""); setOpen(true);
    window.setTimeout(() => inputs.current[0]?.focus(), 80);
  }, [session.authorized]);

  const submit = async () => {
    const pin = digits.join("");
    if (pin.length !== 4 || busy || retryAfter > 0) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/verify-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const data = await response.json();
      if (!response.ok) {
        setDigits(["", "", "", ""]); inputs.current[0]?.focus();
        setError(data.error || "Management code is incorrect. Please try again.");
        if (data.retryAfterSeconds) setRetryAfter(data.retryAfterSeconds);
        return;
      }
      unlockedThisPage.current = true;
      await refreshSession(); setOpen(false);
      const action = pending.current; pending.current = null;
      if (action) await action();
    } finally { setBusy(false); }
  };

  const setDigit = (index: number, value: string) => {
    const last = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, i) => i === index ? last : digit));
    setError("");
    if (last && index < 3) inputs.current[index + 1]?.focus();
  };

  const cancel = () => { pending.current = null; setOpen(false); setError(""); setDigits(["", "", "", ""]); };
  const lock = async () => { unlockedThisPage.current = false; await fetch("/api/admin/session", { method: "DELETE" }); setSession({ authorized: false, expiresAt: null, remainingSeconds: 0 }); };

  return (
    <AdminContext.Provider value={{ requireAdmin, session, refreshSession, lock }}>
      {children}
      <Dialog.Root open={open} onOpenChange={(value) => value ? setOpen(true) : cancel()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-[#111418] p-6 shadow-2xl outline-none">
            <div className="mb-5 flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acid/10 text-acid"><LockKeyhole size={21} /></span><Dialog.Close asChild><button aria-label="Cancel" className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white"><X size={19} /></button></Dialog.Close></div>
            <Dialog.Title className="font-display text-xl font-bold tracking-[-.03em]">Enter the 4-digit management code</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-500">Public viewing remains open. Refreshing the page locks management again.</Dialog.Description>
            <div className="my-6 flex justify-between gap-2" onPaste={(event) => { const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4); if (value) { event.preventDefault(); setDigits(Array.from({ length: 4 }, (_, index) => value[index] ?? "")); inputs.current[Math.min(value.length, 4) - 1]?.focus(); } }}>
              {digits.map((digit, index) => <input key={index} ref={(node) => { inputs.current[index] = node; }} aria-label={`Management code digit ${index + 1}`} value={digit} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus(); if (event.key === "Enter") void submit(); }} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={1} className="h-16 w-14 rounded-2xl border border-line bg-[#0b0d10] text-center font-display text-2xl font-bold outline-none transition-colors focus:border-acid md:w-16" />)}
            </div>
            {error && <p role="alert" className="mb-4 rounded-xl bg-coral/10 px-3 py-2.5 text-sm text-coral">{error}{retryAfter > 0 ? ` (${Math.ceil(retryAfter / 60)} min)` : ""}</p>}
            <div className="grid grid-cols-2 gap-3"><Button variant="secondary" onClick={cancel}>Cancel</Button><Button onClick={() => void submit()} disabled={digits.some((digit) => !digit) || busy || retryAfter > 0}>{busy ? "Checking…" : <><ShieldCheck size={17} /> Confirm</>}</Button></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AdminContext.Provider>
  );
}
