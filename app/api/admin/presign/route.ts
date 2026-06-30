import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extensionFromName } from "@/lib/media";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    filename?: string;
    type?: string;
    motionVideoFilename?: string;
  } | null;

  const filename = body?.filename ?? "file";
  const type = body?.type ?? "image";
  const motionVideoFilename = body?.motionVideoFilename;

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  if (type === "motion") {
    const stillExt = extensionFromName(filename) || "jpg";
    const videoExt = extensionFromName(motionVideoFilename ?? "") || "mp4";
    const base = `motion/${today}/${randomUUID()}`;
    const stillPath = `${base}.${stillExt}`;
    const videoPath = `${base}_video.${videoExt}`;

    const { data: stillData, error: stillErr } = await supabase.storage
      .from("chat-media")
      .createSignedUploadUrl(stillPath);
    if (stillErr) return Response.json({ error: stillErr.message }, { status: 500 });

    const { data: videoData, error: videoErr } = await supabase.storage
      .from("chat-media")
      .createSignedUploadUrl(videoPath);
    if (videoErr) return Response.json({ error: videoErr.message }, { status: 500 });

    return Response.json({
      stillUrl: stillData.signedUrl,
      stillPath,
      videoUrl: videoData.signedUrl,
      videoPath,
    });
  }

  const ext = extensionFromName(filename) || "bin";
  const path = `${type}/${today}/${randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUploadUrl(path);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ url: data.signedUrl, path });
}
