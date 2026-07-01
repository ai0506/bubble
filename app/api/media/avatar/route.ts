import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// 按 idolId 代理头像：私有 bucket 不直接暴露，短期签名 URL 转发字节。
export async function GET(request: NextRequest) {
  const idolId = request.nextUrl.searchParams.get("idolId")?.trim() || "";
  if (!idolId) {
    return Response.json({ error: "idolId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: idol, error: idolError } = await supabase
    .from("idols")
    .select("avatar_path")
    .eq("id", idolId)
    .maybeSingle();

  if (idolError) {
    return Response.json({ error: idolError.message }, { status: 500 });
  }
  if (!idol?.avatar_path) {
    return Response.json({ error: "Avatar not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(idol.avatar_path, 60 * 60, { transform: { width: 128, height: 128, resize: "cover" } });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const mediaResponse = await fetch(data.signedUrl);
  const headers = new Headers();
  const contentType = mediaResponse.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("Cache-Control", "private, max-age=300");

  return new Response(mediaResponse.body, { status: mediaResponse.status, headers });
}
