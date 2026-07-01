import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OSS from "ali-oss";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^"|"$/g, "");
      }
    }
  } catch {
    // The script can also run with environment variables provided by the shell.
  }
}

function env(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function requireEnv(...names) {
  const value = env(...names);
  if (!value) throw new Error(`Missing environment variable: ${names.join(" or ")}`);
  return value;
}

async function objectExists(client, key) {
  try {
    await client.head(key);
    return true;
  } catch (error) {
    if (error?.status === 404 || error?.code === "NoSuchKey" || error?.name === "NoSuchKeyError") {
      return false;
    }
    throw error;
  }
}

function contentTypeFromBlob(blob) {
  return blob?.type || "application/octet-stream";
}

loadEnvFile(".env.local");

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const oss = new OSS({
  accessKeyId: requireEnv("ALI_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_ID"),
  accessKeySecret: requireEnv("ALI_OSS_ACCESS_KEY_SECRET", "ALIYUN_OSS_ACCESS_KEY_SECRET"),
  bucket: requireEnv("ALI_OSS_BUCKET", "ALIYUN_OSS_BUCKET"),
  region: requireEnv("ALI_OSS_REGION", "ALIYUN_OSS_REGION"),
  endpoint: env("ALI_OSS_ENDPOINT", "ALIYUN_OSS_PUBLIC_ENDPOINT") || undefined,
  secure: true,
});

const keys = new Set();

const { data: messages, error: messagesError } = await supabase
  .from("messages")
  .select("media_path, motion_video_path");
if (messagesError) throw new Error(`Failed to read messages: ${messagesError.message}`);
for (const row of messages ?? []) {
  if (row.media_path) keys.add(row.media_path);
  if (row.motion_video_path) keys.add(row.motion_video_path);
}

const { data: idols, error: idolsError } = await supabase
  .from("idols")
  .select("avatar_path");
if (idolsError) throw new Error(`Failed to read idols: ${idolsError.message}`);
for (const row of idols ?? []) {
  if (row.avatar_path) keys.add(row.avatar_path);
}

const allKeys = Array.from(keys).sort();
console.log(`Found ${allKeys.length} storage object key(s).`);
if (dryRun) {
  for (const key of allKeys) console.log(`[dry-run] ${key}`);
  process.exit(0);
}

let copied = 0;
let skipped = 0;

for (const key of allKeys) {
  if (!force && await objectExists(oss, key)) {
    skipped += 1;
    console.log(`[skip] ${key}`);
    continue;
  }

  const { data, error } = await supabase.storage.from("chat-media").download(key);
  if (error) throw new Error(`Failed to download ${key}: ${error.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  await oss.put(key, buffer, {
    headers: {
      "Content-Type": contentTypeFromBlob(data),
    },
  });
  copied += 1;
  console.log(`[copy] ${key}`);
}

console.log(`Done. copied=${copied} skipped=${skipped} total=${allKeys.length}`);
