#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = skip the deploy, exit 1 = deploy.
# Deploys only when the PR title (or, on main, the squashed commit title) is
# feat(frontend): ..., fix(frontend): ... or chore(frontend): ...

if [ -n "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  title=$(curl -fsS --max-time 10 \
    "https://api.github.com/repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/pulls/$VERCEL_GIT_PULL_REQUEST_ID" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).title||""))' 2>/dev/null)
else
  title=$(printf '%s' "$VERCEL_GIT_COMMIT_MESSAGE" | head -n 1)
fi

echo "Title checked: ${title:-<none>}"

if printf '%s' "$title" | grep -Eq '^(feat|fix|chore)\(frontend\): '; then
  echo "Matches feat/fix/chore(frontend): deploying."
  exit 1
fi

echo "Not a frontend feat/fix/chore title: skipping deploy."
exit 0
