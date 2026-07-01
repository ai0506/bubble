"use client";

import { ChevronRight } from "lucide-react";
import type { Idol } from "@/lib/types";

const DEFAULT_SITE_NAME = "asw的Bubble";
const TITLE = "选择爱豆";
const SUBTITLE = "订阅后即可查看 TA 的消息并留言";
const EMPTY = "还没有爱豆";

type IdolDiscoveryProps = {
  idols: Idol[];
  loading: boolean;
  onSelect: (handle: string) => void;
};

function Avatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1) || "?";
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600">
      {initial}
    </div>
  );
}

export function IdolDiscovery({ idols, loading, onSelect }: IdolDiscoveryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-semibold">{process.env.NEXT_PUBLIC_SITE_NAME || DEFAULT_SITE_NAME}</h1>
        <p className="text-xs text-slate-500">{SUBTITLE}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <p className="px-1 pb-2 text-xs font-medium text-slate-400">{TITLE}</p>
        {loading ? <p className="p-6 text-center text-sm text-slate-500">加载中...</p> : null}
        {!loading && idols.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{EMPTY}</p>
        ) : null}
        <div className="space-y-2">
          {idols.map((idol) => (
            <button
              key={idol.id}
              type="button"
              onClick={() => onSelect(idol.handle)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
            >
              <Avatar name={idol.display_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{idol.display_name}</p>
                <p className="truncate text-xs text-slate-500">{idol.bio || `@${idol.handle}`}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
