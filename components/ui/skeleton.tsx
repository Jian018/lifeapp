import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-xl bg-white/[.06]", className)} />;
}

export function PageSkeleton() {
  return <div className="page-wrap"><Skeleton className="mb-4 h-5 w-32" /><Skeleton className="mb-10 h-12 w-72" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;
}
