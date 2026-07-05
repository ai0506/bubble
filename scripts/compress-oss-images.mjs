import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OSS from "ali-oss";
import sharp from "sharp";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const DEFAULT_MAX_WIDTH = 1080;
const DEFAULT_QUALITY = 78;
const DEFAULT_MIN_SAVING_RATIO = 0.08;

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

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function byteLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function imageKindFromKey(key) {
  if (/\.jpe?g$/i.test(key)) return "jpeg";
  if (/\.png$/i.test(key)) return "png";
  if (/\.webp$/i.test(key)) return "webp";
  return null;
}

async function listReferencedKeys(supabase) {
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

  return Array.from(keys).filter((key) => imageKindFromKey(key)).sort();
}

async function readObject(oss, key) {
  const result = await oss.get(key);
  return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
}

async function compressImage(buffer, kind, maxWidth, quality) {
  const image = sharp(buffer, { animated: false, limitInputPixels: 80_000_000 }).rotate();
  const metadata = await image.metadata();
  const resize =
    metadata.width && metadata.width > maxWidth
      ? image.resize({ width: maxWidth, withoutEnlargement: true })
      : image;

  if (kind === "jpeg") {
    return resize.jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  if (kind === "png") {
    return resize.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true }).toBuffer();
  }
  return resize.webp({ quality }).toBuffer();
}

loadEnvFile(".env.local");

const apply = process.argv.includes("--apply");
const backup = process.argv.includes("--backup");
const maxWidth = Math.round(readNumberArg("max-width", DEFAULT_MAX_WIDTH));
const quality = Math.min(Math.round(readNumberArg("quality", DEFAULT_QUALITY)), 100);
const minSavingRatio = readNumberArg("min-saving", DEFAULT_MIN_SAVING_RATIO);
const limit = Math.round(readNumberArg("limit", Number.POSITIVE_INFINITY));

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

const keys = (await listReferencedKeys(supabase)).slice(0, limit);
console.log(`Found ${keys.length} referenced JPG/PNG/WebP object(s).`);
console.log(`Mode: ${apply ? "apply" : "dry-run"}; maxWidth=${maxWidth}; quality=${quality}; minSaving=${minSavingRatio}`);

let scanned = 0;
let changed = 0;
let skipped = 0;
let failed = 0;
let originalTotal = 0;
let compressedTotal = 0;

for (const key of keys) {
  const kind = imageKindFromKey(key);
  if (!kind) continue;

  try {
    scanned += 1;
    const original = await readObject(oss, key);
    const compressed = await compressImage(original, kind, maxWidth, quality);
    const saving = original.length - compressed.length;
    const savingRatio = saving / original.length;

    if (saving <= 0 || savingRatio < minSavingRatio) {
      skipped += 1;
      console.log(`[skip] ${key} ${byteLabel(original.length)} -> ${byteLabel(compressed.length)}`);
      continue;
    }

    changed += 1;
    originalTotal += original.length;
    compressedTotal += compressed.length;

    if (apply) {
      if (backup) {
        await oss.put(`_backup_before_compress/${key}`, original, {
          headers: {
            "Content-Type": kind === "jpeg" ? "image/jpeg" : `image/${kind}`,
            "Cache-Control": CACHE_CONTROL,
          },
        });
      }
      await oss.put(key, compressed, {
        headers: {
          "Content-Type": kind === "jpeg" ? "image/jpeg" : `image/${kind}`,
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    console.log(
      `[${apply ? "write" : "would-write"}] ${key} ${byteLabel(original.length)} -> ${byteLabel(compressed.length)} saved ${byteLabel(saving)}`,
    );
  } catch (error) {
    failed += 1;
    console.error(`[fail] ${key} ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(
  `Done. scanned=${scanned} ${apply ? "changed" : "wouldChange"}=${changed} skipped=${skipped} failed=${failed}`,
);
console.log(
  `Potential saving: ${byteLabel(originalTotal - compressedTotal)} (${byteLabel(originalTotal)} -> ${byteLabel(compressedTotal)})`,
);

if (!apply) {
  console.log("Dry run only. Re-run with --apply to overwrite OSS objects, or --apply --backup to keep originals under _backup_before_compress/.");
}
