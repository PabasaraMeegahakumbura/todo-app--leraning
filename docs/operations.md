# Daily operations and releases

[Documentation home](../README.md) · [Troubleshooting](troubleshooting.md)

## Start a working day

Open Docker Desktop and wait for the engine/local node. Open the repository in
VS Code with a PowerShell terminal. Inspect before changing:

```powershell
git status
kubectl --context docker-desktop get nodes
kubectl --context docker-desktop get pods,hpa,ingress
kubectl --context docker-desktop -n argocd get application todo-app
```

App: https://clearday.localhost. Argo: https://localhost:8083. No port-forward
terminal is required. Compose's port-80 proxy conflicts with Kubernetes Traefik.

## Branches, commits, and PRs

Preserve existing uncommitted work first. Do not use reset/clean blindly.
From an updated main, create one branch for a coherent feature or fix:

```powershell
git switch main
git pull --ff-only
git switch -c feature/descriptive-name
```

The name is an example. Related code, tests, and docs belong in the same branch;
multiple commits and review fixes can share one PR. After editing:

```powershell
git status
git diff
git add PATH_TO_INTENDED_FILE
git diff --cached
git commit -m "Describe the resulting behavior"
git push -u origin HEAD
```

Replace the file placeholder. Prefer specific paths over staging everything
when backups/credentials could be present. New files appear in status, not an
ordinary diff. On GitHub choose the personal fork as base repository, main as
base, and the actual current feature branch as compare. Review Files changed,
wait for CI, and merge. Update local main afterward. A merged source branch is
not the routine place for unrelated future work. Delete stale merged branches
when no longer needed.

## Release code: publish first, select the image second

### Stage A: test and publish

```powershell
docker build --target test --progress=plain .
docker build -t clear-day:review .
```

The test stage runs backend Jest. Final also builds React. Successful cached
test layers can be reused. Neither command updates a running container.
Optional preview with separate SQLite data:

```powershell
docker run -d --name clear-day-review -p 8084:3000 -v clear-day-review-data:/etc/todos clear-day:review
```

Choose unused name/port if needed; inspect existing containers before replacing.
Rebuilding a tag does not update an existing container. Check UI CRUD, filters,
search, failure behavior, keyboard access, and mobile width. Preview SQLite is
not Kubernetes MySQL. Commit/push, review PR, merge, and wait for main's Publish
image step to succeed.

### Stage B: deploy the intended version

Copy the full SHA tag from the successful main run containing your source
change. Do not use a stale package page, a feature-only SHA, or an unrelated
configuration commit because it looks recent. Push logs have TAG: digest:
sha256:...; TAG is the identifier used by this project.

On a reviewed deployment branch, change the image in k8s/deployment.yaml. Keep
env, probes, and storage settings intact. Commit/push/PR/merge. Argo auto-syncs
main/k8s. A new image may also be published for this configuration merge; there
is no need to chase that SHA in an endless sequence of tag-update PRs.

```powershell
kubectl --context docker-desktop rollout status deployment/todo-app --timeout=180s
kubectl --context docker-desktop get pods -l app=todo-app -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image'
```

Confirm Synced + Healthy, selected image, browser UI, and CRUD. Readiness proves
the configured version runs, not that the selected tag contains your intended
UI. Refresh requests a Git comparison; Sync applies. Do not also manually apply
the same app manifests as the normal GitOps release procedure.

## Management boundaries

| Component | Owner/update method |
| --- | --- |
| App manifests under k8s | Argo automatic sync from main |
| Argo Application definition | Explicit bootstrap/admin apply; outside its watched path |
| Traefik chart/settings | Pinned Helm upgrade with saved values |
| Password/TLS Secrets | Separate runtime provisioning |
| MySQL users/data | SQL administration and backup/restore |

Prune and self-heal are off. Removing a file from Git does not automatically
delete its resource. Self-heal false does not stop new revision syncs reapplying
desired settings. Avoid competing manual/Git/HPA control of the same field.
Current follow-up: remove app spec.replicas in a reviewed change; HPA owns scale.

## ConfigMap updates

GREETING is read at startup. Updating ConfigMap alone does not replace process
environment. Include a changed Pod-template annotation in the same PR to trigger
a rollout with the new value:

```yaml
# Under spec.template.metadata, alongside labels
annotations:
  learning.clearday.dev/release: "config-update-2"
```

Use a new intentional value for later rollouts. Test /api/greeting: the Clear Day
page does not render that legacy greeting. No rebuild is needed if existing
code already reads the variable. Do not commit generated status/managedFields.

## Logs, probes, metrics

```powershell
kubectl --context docker-desktop describe pod -l app=todo-app
kubectl --context docker-desktop logs -l app=todo-app --tail=20 --prefix=true
kubectl --context docker-desktop logs deployment/todo-mysql --tail=20
kubectl --context docker-desktop top pods
kubectl --context docker-desktop top nodes
kubectl --context docker-desktop describe hpa todo-app
curl.exe --ssl-revoke-best-effort https://clearday.localhost/api/health/live
curl.exe --ssl-revoke-best-effort https://clearday.localhost/api/health/ready
```

Deployment logs can select just one Pod; label logs distinguish replicas. Events
help identify missing Secrets/PVCs, image pulls, scheduling, and probe failures.
Metrics are recent, not historical. 1m CPU is 0.001 core. Mi is mebibytes.
HPA's 50% target means about 50m per Pod given 100m requests. Scale-down can take
several minutes. More Pods do not automatically fix database bottlenecks.

The earlier load test used HTTP localhost:8082, now intentionally closed. A new
HTTPS load-generator container needs explicit local CA certificate trust; never
copy the CA private key into it or disable TLS verification globally. Keep load
testing bounded and only against your own local app.

## Rollback

For GitOps, restore a known-good published image tag in a reviewed Git commit,
merge, and let Argo apply it. Check database compatibility first. Code rollback
does not undo data or schema changes. Git revert can reverse a chosen commit,
but inspect it before reverting unrelated changes together.

Cluster history commands from the learning exercise:

```powershell
kubectl --context docker-desktop rollout history deployment/todo-app
kubectl --context docker-desktop rollout history deployment/todo-app --revision=5
```

5 is a historical example, not a universal rollback target. Inspect the whole
Pod template: rollout undo restores env/probes/resources/mounts as well as image.
It does not change Git and may be overwritten later. Use a reviewed Git change
for durable rollback, rather than normalizing emergency live drift.

## Shutdown and restart

Closing VS Code does not stop detached containers or Kubernetes. Restarting a
laptop stops local services; open Docker Desktop and wait afterward. Do not
reset/recreate for a normal reboot. Compose down -v, PVC deletion, volume pruning,
and cluster reset can destroy data; they are not routine shutdown steps.
See [recovery](recovery.md) if the cluster truly cannot be recovered.
