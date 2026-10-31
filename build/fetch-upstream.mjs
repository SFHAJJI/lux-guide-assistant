// Fetches the guide's source at the pinned commit into upstream/ (git-ignored) and checks the data files' hashes.
// The guide belongs to its author: nothing of it is committed here. The manifest pins what the build reads.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "build", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const up = manifest.upstream;
const dir = join(root, "upstream");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" }).trim();
}

const current = existsSync(join(dir, ".git")) ? git(["rev-parse", "HEAD"], dir) : null;
if (current !== up.commit) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(["init", "-q"], dir);
  git(["fetch", "-q", "--depth", "1", up.repo, up.commit], dir);
  git(["checkout", "-q", "FETCH_HEAD"], dir);
}
console.log(`upstream ${up.repo} @ ${git(["rev-parse", "HEAD"], dir)}`);

let changed = false;
for (const rel of Object.keys(up.files)) {
  // Hashed with LF line endings whatever the checkout did, so Windows and Linux agree on the same bytes.
  const sha = createHash("sha256").update(readFileSync(join(dir, rel), "utf8").replace(/\r\n/g, "\n")).digest("hex");
  if (up.files[rel] === null) { up.files[rel] = sha; changed = true; console.log(`pinned ${rel} ${sha.slice(0, 12)}`); }
  else if (up.files[rel] !== sha) throw new Error(`${rel} differs from the manifest: upstream changed at the pinned commit?`);
  else console.log(`ok     ${rel} ${sha.slice(0, 12)}`);
}
if (changed) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
