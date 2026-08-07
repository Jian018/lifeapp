import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="page-wrap"><div className="panel flex min-h-72 flex-col items-center justify-center p-8 text-center"><AlertTriangle className="mb-4 text-coral" /><h2 className="font-display text-xl font-bold">Something went off track</h2><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{message}</p><Button variant="secondary" className="mt-6" onClick={retry}><RotateCw size={16} />Try again</Button></div></div>;
}
