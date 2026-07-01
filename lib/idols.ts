import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Idol } from "@/lib/types";

// 服务端行：比对外暴露的 Idol 多出 password_hash，切勿返回给前端。
export type IdolRow = Idol & { password_hash: string };

// 存量消息、旧接口未传 idol_id 时统一回退到的默认爱豆 handle。
export const DEFAULT_IDOL_HANDLE = "asw";

export const IDOL_HANDLE_PATTERN = /^[a-z0-9_-]{2,32}$/;

export async function getIdolById(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("idols").select("*").eq("id", id).maybeSingle();
  return (data as IdolRow | null) ?? null;
}

export async function getIdolByHandle(supabase: SupabaseClient, handle: string) {
  const { data } = await supabase.from("idols").select("*").eq("handle", handle).maybeSingle();
  return (data as IdolRow | null) ?? null;
}

export async function getDefaultIdolId(supabase: SupabaseClient) {
  const idol = await getIdolByHandle(supabase, DEFAULT_IDOL_HANDLE);
  return idol?.id ?? null;
}

// 解析写入消息时的目标爱豆：优先用传入的 idolId（需存在且启用），
// 否则回退到默认爱豆 asw。返回 null 表示连默认爱豆都不存在（异常）。
export async function resolveWritableIdolId(supabase: SupabaseClient, idolId?: string | null) {
  if (idolId) {
    const idol = await getIdolById(supabase, idolId);
    if (idol && idol.is_active) return idol.id;
  }
  return getDefaultIdolId(supabase);
}
