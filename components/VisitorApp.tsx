"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatScreen } from "@/components/ChatScreen";
import { IdolDiscovery } from "@/components/IdolDiscovery";
import type { Idol } from "@/lib/types";

export function VisitorApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handle = searchParams.get("idol")?.trim().toLowerCase() || "";

  const [idols, setIdols] = useState<Idol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadIdols() {
      try {
        const response = await fetch("/api/idols", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { idols: Idol[] };
        if (!cancelled) setIdols(data.idols);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadIdols();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectIdol = useCallback(
    (nextHandle: string) => {
      router.push(`/?idol=${encodeURIComponent(nextHandle)}`);
    },
    [router],
  );

  const goBack = useCallback(() => {
    router.push("/");
  }, [router]);

  const selectedIdol = handle ? idols.find((idol) => idol.handle === handle) : undefined;

  // 指定了 idol 且已在列表中命中 → 进入聊天
  if (selectedIdol) {
    return <ChatScreen idol={selectedIdol} onBack={goBack} />;
  }

  // 指定了 idol 但列表还在加载：先等待，避免闪现发现页
  if (handle && loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">加载中...</div>;
  }

  // 未指定 idol，或指定的 handle 不存在 → 发现页
  return <IdolDiscovery idols={idols} loading={loading} onSelect={selectIdol} />;
}
