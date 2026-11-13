// Before-and-after screenshots for a PR, taken on this computer (no GitHub runner).
//
//   cd frontend && npm run pr-shots            # PR for the current branch
//   cd frontend && npm run pr-shots -- 12      # a specific PR number
//
// 1. Builds this branch and takes desktop + phone screenshots   (AFTER)
// 2. Builds the base branch (main) in a temporary copy, same shots (BEFORE)
// 3. Saves them on the `pr-screenshots` side branch, in pr-<number>/
// 4. Writes a before/after table into the PR description, between the
//    <!-- pbj-shots:start --> and <!-- pbj-shots:end --> markers
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (cmd, cwd, quiet = true) => execSync(cmd, { cwd, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" })?.trim();
const step = (msg) => console.log(`\n▶ ${msg}`);

const root = run("git rev-parse --show-toplevel");
const frontend = join(root, "frontend");
const shotScript = join(frontend, "scripts", "screenshots.mjs");
const tmp = mkdtempSync(join(tmpdir(), "pbj-shots-"));
const START = "<!-- pbj-shots:start -->", END = "<!-- pbj-shots:end -->";

const pr = JSON.parse(run(`gh pr view ${process.argv[2] || ""} --json number,body,baseRefName,url`, root));
const repo = run("gh repo view --json nameWithOwner --jq .nameWithOwner", root);
const base = `origin/${pr.baseRefName}`;
console.log(`PR #${pr.number} (${pr.url}), comparing with ${base}`);

const worktrees = [];
const cleanup = () => {
  for (const w of worktrees) { try { run(`git worktree remove --force "${w}"`, root); } catch {} }
  rmSync(tmp, { recursive: true, force: true });
};

try {
  run(`git fetch -q origin ${pr.baseRefName}`, root);
  run("npx playwright install chromium", frontend, false); // no-op once downloaded

  step("AFTER: building this branch");
  run("npm run build", frontend, false);
  run(`node "${shotScript}" dist "${join(tmp, "after")}"`, frontend, false);

  step(`BEFORE: building ${base}`);
  const baseDir = join(tmp, "base");
  run(`git worktree add -q --detach "${baseDir}" ${base}`, root);
  worktrees.push(baseDir);
  // Older main had the site in the top folder; newer main has it in frontend/
  const baseSite = existsSync(join(baseDir, "frontend", "package.json")) ? join(baseDir, "frontend") : baseDir;
  const sameDeps = readFileSync(join(baseSite, "package-lock.json"), "utf8") === readFileSync(join(frontend, "package-lock.json"), "utf8");
  if (sameDeps && existsSync(join(frontend, "node_modules"))) symlinkSync(join(frontend, "node_modules"), join(baseSite, "node_modules"), "dir");
  else run("npm ci", baseSite, false);
  run("npm run build", baseSite, false);
  run(`node "${shotScript}" dist "${join(tmp, "before")}"`, baseSite, false);

  step("Saving screenshots on the pr-screenshots branch");
  const side = join(tmp, "side");
  const hasSide = run("git ls-remote --heads origin pr-screenshots", root) !== "";
  if (hasSide) {
    run("git fetch -q origin pr-screenshots", root);
    run(`git worktree add -q --detach "${side}" FETCH_HEAD`, root);
  } else {
    run(`git worktree add -q --detach "${side}"`, root);
    run("git checkout -q --orphan pr-screenshots-new && git rm -rq --cached . && git clean -fdxq", side);
  }
  worktrees.push(side);
  const dir = `pr-${pr.number}`;
  rmSync(join(side, dir), { recursive: true, force: true });
  cpSync(join(tmp, "before"), join(side, dir, "before"), { recursive: true });
  cpSync(join(tmp, "after"), join(side, dir, "after"), { recursive: true });
  run(`git add "${dir}" && git commit -qm "Screenshots for PR ${pr.number}" --no-verify`, side);
  run("git push -q origin HEAD:refs/heads/pr-screenshots", side);
  const sha = run("git rev-parse HEAD", side);

  step("Updating the PR description");
  const img = (p) => `<img src="https://raw.githubusercontent.com/${repo}/${sha}/${dir}/${p}" width="100%">`;
  const lines = [START, "## Before and after", `_Taken locally against \`${base}\` on ${new Date().toISOString().slice(0, 10)}._`, ""];
  for (const s of ["desktop", "phone"]) {
    lines.push(`### ${s[0].toUpperCase() + s.slice(1)}`, "| Before (main) | After (this PR) |", "|---|---|");
    for (let i = 1; i <= 3; i++) lines.push(`| ${img(`before/${s}-${i}.png`)} | ${img(`after/${s}-${i}.png`)} |`);
    lines.push("");
  }
  lines.push(END);
  const block = lines.join("\n");
  const body = pr.body || "";
  const a = body.indexOf(START), b = body.indexOf(END);
  const next = a >= 0 && b > a ? body.slice(0, a) + block + body.slice(b + END.length) : `${body.trimEnd()}\n\n${block}\n`;
  const bodyFile = join(tmp, "body.md");
  writeFileSync(bodyFile, next);
  run(`gh pr edit ${pr.number} --body-file "${bodyFile}"`, root);
  console.log(`\n✅ Screenshots added to ${pr.url}`);
} finally {
  cleanup();
}
