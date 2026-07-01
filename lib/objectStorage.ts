import "server-only";

import OSS from "ali-oss";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type UploadObjectInput = {
  key: string;
  file: File | Blob | Buffer;
  contentType?: string;
};

export type SignedReadUrlInput = {
  key: string;
  expiresInSeconds: number;
  contentTypeHint?: string;
};

type Provider = "oss" | "supabase";

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function getProvider(): Provider {
  const configured = env("MEDIA_STORAGE_PROVIDER").toLowerCase();
  if (configured === "supabase" || configured === "oss") return configured;

  return env("ALI_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_ID") ? "oss" : "supabase";
}

function getOssClient() {
  const accessKeyId = env("ALI_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_ID");
  const accessKeySecret = env("ALI_OSS_ACCESS_KEY_SECRET", "ALIYUN_OSS_ACCESS_KEY_SECRET");
  const bucket = env("ALI_OSS_BUCKET", "ALIYUN_OSS_BUCKET");
  const region = env("ALI_OSS_REGION", "ALIYUN_OSS_REGION");
  const endpoint = env("ALI_OSS_ENDPOINT", "ALIYUN_OSS_PUBLIC_ENDPOINT");

  const missing = [
    ["ALI_OSS_ACCESS_KEY_ID", accessKeyId],
    ["ALI_OSS_ACCESS_KEY_SECRET", accessKeySecret],
    ["ALI_OSS_BUCKET", bucket],
    ["ALI_OSS_REGION", region],
    ["ALI_OSS_ENDPOINT", endpoint],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing OSS environment variables: ${missing.map(([name]) => name).join(", ")}`);
  }

  return new OSS({
    region,
    endpoint: endpoint || undefined,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true,
  });
}

async function toBuffer(file: File | Blob | Buffer) {
  if (Buffer.isBuffer(file)) return file;
  return Buffer.from(await file.arrayBuffer());
}

export async function uploadObject(input: UploadObjectInput): Promise<void> {
  if (getProvider() === "supabase") {
    const { error } = await getSupabaseAdmin().storage
      .from("chat-media")
      .upload(input.key, input.file, {
        contentType: input.contentType || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    return;
  }

  await getOssClient().put(input.key, await toBuffer(input.file), {
    headers: {
      "Content-Type": input.contentType || "application/octet-stream",
    },
  });
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) return;

  if (getProvider() === "supabase") {
    const { error } = await getSupabaseAdmin().storage.from("chat-media").remove(uniqueKeys);
    if (error) throw new Error(error.message);
    return;
  }

  if (uniqueKeys.length === 1) {
    await getOssClient().delete(uniqueKeys[0]);
    return;
  }
  await getOssClient().deleteMulti(uniqueKeys, { quiet: true });
}

export async function createSignedReadUrl(input: SignedReadUrlInput): Promise<string> {
  if (getProvider() === "supabase") {
    const { data, error } = await getSupabaseAdmin().storage
      .from("chat-media")
      .createSignedUrl(input.key, input.expiresInSeconds);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  return getOssClient().signatureUrl(input.key, {
    expires: input.expiresInSeconds,
    method: "GET",
  });
}

export async function createSignedUploadUrl(
  key: string,
  expiresInSeconds: number,
  contentType?: string,
): Promise<string> {
  if (getProvider() === "supabase") {
    const { data, error } = await getSupabaseAdmin().storage
      .from("chat-media")
      .createSignedUploadUrl(key);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  return getOssClient().signatureUrl(key, {
    expires: expiresInSeconds,
    method: "PUT",
    "Content-Type": contentType,
  });
}
