import { readFileSync } from "node:fs";
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

loadEnvFile(".env.local");

const bucket = requireEnv("ALI_OSS_BUCKET", "ALIYUN_OSS_BUCKET");
const oss = new OSS({
  accessKeyId: requireEnv("ALI_OSS_ACCESS_KEY_ID", "ALIYUN_OSS_ACCESS_KEY_ID"),
  accessKeySecret: requireEnv("ALI_OSS_ACCESS_KEY_SECRET", "ALIYUN_OSS_ACCESS_KEY_SECRET"),
  bucket,
  region: requireEnv("ALI_OSS_REGION", "ALIYUN_OSS_REGION"),
  endpoint: env("ALI_OSS_ENDPOINT", "ALIYUN_OSS_PUBLIC_ENDPOINT") || undefined,
  secure: true,
});

const rules = [
  {
    allowedOrigin: ["*"],
    allowedMethod: ["GET", "HEAD", "PUT"],
    allowedHeader: ["*"],
    exposeHeader: ["ETag", "Content-Length", "Content-Type"],
    maxAgeSeconds: 3600,
  },
];

await oss.putBucketCORS(bucket, rules);
const result = await oss.getBucketCORS(bucket);
console.log(`Updated OSS CORS for bucket ${bucket}:`);
console.log(JSON.stringify(result.rules, null, 2));
