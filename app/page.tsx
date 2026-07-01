import { Suspense } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { VisitorApp } from "@/components/VisitorApp";

export default function HomePage() {
  return (
    <PhoneShell>
      <Suspense
        fallback={<div className="flex flex-1 items-center justify-center text-sm text-slate-500">加载中...</div>}
      >
        <VisitorApp />
      </Suspense>
    </PhoneShell>
  );
}
