// 用真实凭据验证签名实现：读 rclone.conf（不经聊天、不落临时文件），打一次 ListObjectsV2。
//   node test/live.test.mjs
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { s3, presignGet } from "../docs/s3.js";

function parseRclone(text) {
  const cfg = {};
  let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) { cur = section[1]; cfg[cur] = {}; continue; }
    if (!cur) continue;
    const [k, ...rest] = line.split("=");
    cfg[cur][k.trim()] = rest.join("=").trim();
  }
  return cfg;
}

const confPath = join(homedir(), ".config/rclone/rclone.conf");
const conf = parseRclone(await readFile(confPath, "utf8"));
const remote = conf.osca;
if (!remote) { console.error("rclone.conf 里没有 [osca]"); process.exit(1); }

const cfg = {
  endpoint: remote.endpoint,
  bucket: process.env.OSCA_BUCKET || "22134-lan1081210",
  accessKey: remote.access_key_id,
  secretKey: remote.secret_access_key,
  region: remote.region || "us-east-1",
};
console.log("endpoint:", cfg.endpoint, "| bucket:", cfg.bucket);
console.log("凭据来源:", confPath, "（未打印密钥）\n");

// 1) 列根目录
const t0 = Date.now();
const res = await s3(cfg, "GET", "", { query: [["list-type", "2"], ["delimiter", "/"], ["max-keys", "10"]] });
const xml = await res.text();
const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map(m => m[1]);
const prefixes = [...xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]*)<\/Prefix>/g)].map(m => m[1]);
console.log(`✓ ListObjectsV2 ${res.status}  ${Date.now() - t0}ms`);
console.log("  目录:", prefixes.slice(0, 5).join("  ") || "(无)");
console.log("  对象:", keys.slice(0, 5).join("  ") || "(无)");

// 2) 预签名 GET 能不能真的取到对象
const probe = keys[0];
if (probe) {
  const url = await presignGet(cfg, probe, 300);
  const head = await fetch(url, { method: "GET", headers: { Range: "bytes=0-64" } });
  console.log(`✓ 预签名 GET ${head.status}  ${probe.slice(0, 60)}`);
} else {
  console.log("(根目录没有对象，跳过预签名测试)");
}

// 3) 写一个探针对象再删掉（验证 PUT 的 payload 哈希与签名）
const probeKey = `_viewer_probe/${Date.now()}.txt`;
const body = new TextEncoder().encode("osca viewer ios probe\n");
await s3(cfg, "PUT", probeKey, { body });
console.log("✓ PUT", probeKey);
const got = await s3(cfg, "GET", probeKey);
const text = await got.text();
console.log("✓ GET 回读:", JSON.stringify(text.trim()));
await s3(cfg, "DELETE", probeKey);
console.log("✓ DELETE 清理完成");
