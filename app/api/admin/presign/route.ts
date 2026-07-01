import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { extensionFromName } from "@/lib/media";
import { createSignedUploadUrl } from "@/lib/objectStorage";

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

  const today = new Date().toISOString().slice(0, 10);

  if (type === "motion") {
    const stillExt = extensionFromName(filename) || "jpg";
    const videoExt = extensionFromName(motionVideoFilename ?? "") || "mp4";
    const base = `motion/${today}/${randomUUID()}`;
    const stillPath = `${base}.${stillExt}`;
    const videoPath = `${base}_video.${videoExt}`;

    let stillUrl: string;
    let videoUrl: string;
    try {
      stillUrl = await createSignedUploadUrl(stillPath, 60 * 10);
      videoUrl = await createSignedUploadUrl(videoPath, 60 * 10);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Create signed upload URL failed" }, { status: 500 });
    }

    return Response.json({
      stillUrl,
      stillPath,
      videoUrl,
      videoPath,
    });
  }

  const ext = extensionFromName(filename) || "bin";
  const path = `${type}/${today}/${randomUUID()}.${ext}`;

  let url: string;
  try {
    url = await createSignedUploadUrl(path, 60 * 10);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Create signed upload URL failed" }, { status: 500 });
  }

  return Response.json({ url, path });
}
