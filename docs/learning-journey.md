# Learning journey: from a cloned app to HTTPS GitOps

[Documentation home](../README.md) · [Architecture](architecture.md)

Read this in sequence to understand why each tool was added. The commands are
examples from the lessons, not instructions to reset a working environment.
See [setup](setup.md) for installation and [operations](operations.md) for the
current workflow. Historical localhost ports below describe earlier stages;
the current Kubernetes address is https://clearday.localhost.

## 1. Understand the application before changing it

We inspected the repository without modifying files or starting services. We
identified React components, Express routes, two persistence implementations,
the multi-stage Dockerfile, and five Compose services.

The central lesson: deployment tools package and operate a normal application;
they do not replace understanding its request/data flow.

Checkpoint: explain browser -> POST /api/items -> route -> database -> JSON ->
React state. Distinguish two files named index.js: backend/src/index.js starts
the HTTP server; backend/src/persistence/index.js chooses the database adapter.

## 2. Learn Git locally, then connect a fork

We forked Docker's official repository. The local checkout uses origin for the
personal fork and upstream for the original project. A remote is a named URL,
not another local working folder.

```powershell
git status
git remote -v
git branch -vv
git log --oneline -5
```

| Command | Meaning |
| --- | --- |
| status | Show working tree/staging/branch state |
| remote -v | Show fetch/push destinations |
| branch -vv | Show branches, latest commits, and tracking branches |
| log | Read committed history |

We created a learning branch and changed the greeting. Editing changed only
local files. Staging selected changes; committing saved a local snapshot;
pushing uploaded commits; a PR proposed merging them into main.

```powershell
git switch -c learning/first-change
git diff -- backend/src/routes/getGreeting.js
git add backend/src/routes/getGreeting.js
git commit -m "Update greeting for DevOps learning"
git push -u origin HEAD
```

`HEAD` means the current branch/commit context. `-u` records the upstream branch
for later pushes/pulls. A short commit ID abbreviates a full SHA. Neither is a
password. `git diff` does not show new untracked file contents; check status too.
When the diff viewer shows `:`, press q to return to the terminal.

On GitHub we learned to choose the personal fork as the PR base repository,
not Docker's repository. An accidental upstream PR was closed without merging.
Closing a PR does not erase its public record. After merging:

```powershell
git switch main
git pull --ff-only
```

Fast-forward updates the branch pointer without making a new local merge commit.
A clean local main can still be behind GitHub until fetched. Windows CRLF versus
Git LF line endings can look like whole-file changes; inspect before committing.

Branch policy learned: use one short-lived branch per coherent feature/fix,
include related documentation and tests, and make multiple commits there. A new
branch for every small lesson was unnecessary. Delete merged feature branches
when no longer needed; keep main as the integration baseline.

## 3. Start Compose and inspect the development stack

```powershell
docker --version
docker compose version
docker info
docker compose config --quiet
docker compose up --watch
```

The engine must run, not merely be installed. `config --quiet` validates the
Compose configuration. `up` creates/starts services; `--watch` enables configured
source sync. Detached `up -d` frees the terminal but does not itself enable watch.

We inspected logs, called the API, and ran a command inside a container:

```powershell
docker compose ps
docker compose logs --tail 20 backend
Invoke-RestMethod http://localhost/api/items
docker compose exec backend node --version
```

The MySQL hostname is mysql inside Compose networking, not localhost. Its named
volume preserved tasks across compose down/up. Down removes containers/network;
-v additionally deletes volumes. This proved containers and persistent data have
separate lifetimes. The current Kubernetes Traefik also uses host port 80, so do
not start the Compose port-80 proxy concurrently without planning different ports.

## 4. Build an image and run the final package

```powershell
docker build --target test --progress=plain .
docker build -t clear-day:local .
docker image ls clear-day
```

The dot is the build context. Docker reads Dockerfile by default. Test builds
execute Jest, while final builds also compile the frontend and package Express
with those assets. CACHED means a prior layer was reused. A successful test
build is not a deployment and does not update running containers.

We ran a final container on a separate host port with its own SQLite volume.
`docker run` creates a new container; stop/start operates on an existing one.
Different host ports allow a development stack and standalone preview to coexist.
Their independent databases do not automatically contain the same tasks.

Checkpoint: explain image versus container, RUN versus CMD, internal port versus
published host port, and why a frontend code change needs a new final image.

## 5. Automate checks in GitHub Actions

We added `.github/workflows/ci.yml` and learned YAML indentation and step lists.
`runs-on` selects the hosted runner; uses invokes a reusable action; run executes
a shell command. Checkout downloads code; the runner is not the laptop.

The workflow grew from a test-stage Docker build to a final-image build and
publication. It now also runs Kubeconform in strict mode against Kubernetes
1.36.0 schemas. We deliberately wrote replica instead of replicas, observed CI
fail, corrected it, and saw green checks. Schema validity does not prove an image
exists, a DB password works, or a network route is reachable.

Checkout was updated to v6 after a runtime warning. Runner OS notices are not
application failures. Both push and pull_request remain triggers, so two runs
can occur for the same feature work. Main pushes publish; feature/PR runs skip
login and publishing.

## 6. Publish to GHCR and select the correct version

GitHub Actions builds an image tagged with its full GITHUB_SHA and publishes to:

```text
ghcr.io/pabasarameegahakumbura/todo-app--leraning:FULL_COMMIT_SHA
```

The workflow uses GITHUB_ACTOR plus a temporary GITHUB_TOKEN with packages:write.
It does not require a Docker Hub password. A package's public/private setting,
not the owner's ability to see it, determines anonymous download access.

A push log has this shape:

```text
FULL_COMMIT_SHA: digest: sha256:CONTENT_DIGEST size: ...
```

The tag is before `: digest`. The digest identifies content. OS/Arch views can
also show provenance entries as unknown/unknown; the normal Installation tag
selects the runnable image. Use the successful main publishing run for the
intended code, not a branch test run or whichever old package page is open.

We downloaded and ran the published image to prove the build was portable.
Publishing does not change an existing Kubernetes image reference.

## 7. Create a local Kubernetes cluster

kubectl was already installed, but its selected context was not the local
learning cluster. We explicitly targeted docker-desktop for all lessons.
Docker Desktop created a one-node kind cluster running Kubernetes 1.36.1.

```powershell
kubectl --context docker-desktop get nodes
```

Ready confirmed the node could participate. kubectl is the client; kubelet is
the node agent. The control plane accepts desired-state requests, stores state,
schedules Pods, and runs controllers. A runtime actually launches containers.
A single-node learning cluster is not a multi-machine availability setup.

## 8. Deploy one Pod and expose it with a Service

A Deployment defines a Pod template. Its ReplicaSet maintains the desired count.
The first Pod moved from ContainerCreating to Running. A declared containerPort
does not publish a browser address.

We used port-forward temporarily, then tried NodePort. NodePort creation did
not guarantee Windows localhost reachability in Docker Desktop kind. A local
LoadBalancer Service provided browser access on 8082. Service selectors and
EndpointSlices helped explain where traffic was sent.

The final design supersedes direct access: app Service is now ClusterIP 8082,
and browser access is through Traefik HTTPS. Keep historical commands separate
from the current architecture.

## 9. Persist SQLite, then move persistence to MySQL

We first mounted a PVC at /etc/todos with a single app replica and Recreate
updates. A task survived deleting/replacing the Pod, proving volume persistence.
ReadWriteOnce means read/write mounting on one node, not universally one Pod.

Later, MySQL got its own 1 GiB claim mounted at /var/lib/mysql. A Secret supplied
the root password. We initialized todos, connected the app, then created todo_app
with database-scoped privileges and switched the app to a separate password
Secret. The old SQLite tasks did not automatically migrate. We removed the
unused SQLite mount, retaining the historical PVC manifest outside Argo sync.

MySQL root is for administration. An app-specific account reduces permissions.
Secret values are not safe to publish just because Kubernetes encodes them.
The MySQL image's initial-password variables initialize an empty data directory;
they do not reset existing database users on every restart.

## 10. Separate configuration from code

The greeting route was changed to read process.env.GREETING with a default. We
built/published a new image to add that behavior, then supplied GREETING through
a ConfigMap. Correct environment text with an old image still returned the old
greeting: configuration cannot add code an image does not contain.

Updating an environment-backed ConfigMap does not alter the already running
process environment. Rolling replacement loads the new value. Clear Day's new
UI uses its own heading, so test the legacy greeting API when practicing this.

## 11. Health probes and resource settings

We introduced startup, readiness, and liveness probes, first using greeting,
then dedicated endpoints. DB adapters gained checkHealth; tests covered HTTP
handler success, DB failure, independence of liveness, and timeout.

| Check | Meaning | Repeated failure consequence |
| --- | --- | --- |
| Startup | Has HTTP startup completed? | Container restart after allowance |
| Readiness | Can the running app query DB? | Remove from ready traffic destinations |
| Liveness | Does Express respond? | Restart container |

During a controlled DB outage, app Pods became unready without liveness-driven
restarts; they became ready after MySQL returned. No ready Pods means users
cannot use the app even if containers remain Running. Readiness is a traffic
signal, not a replacement database or a guarantee of all query correctness.

CPU requests help scheduling and HPA calculations; limits cap usage. We set
100m/128Mi requests and 500m/256Mi limits. Quiet observed usage was lower, but one
snapshot was not grounds for aggressive tuning.

## 12. Updates, rollback, and multiple app replicas

We built a version 2 greeting, published it, changed the Deployment image tag,
and watched replacement. An old image tag caused an old greeting despite a
successful rollout. Readiness confirms the configured version starts, not that
it is the version you intended.

Deployment history contained Pod-template revisions. We inspected image and
volume/probe/resource settings before undoing to a specific number. N was a
placeholder, not a literal CLI argument. Undo changes the cluster, not Git;
reapplying an old file can restore an unintended version. Under GitOps, prefer
a reviewed revert of the intended tag in Git.

Moving to shared MySQL enabled multiple app Pods. RollingUpdate with maxSurge 1
and maxUnavailable 0 starts extra capacity before removing old copies, subject
to readiness and available node resources. We deleted one app Pod and observed
a replacement while the other remained. These tests do not prove node/DB HA.

## 13. Metrics and autoscaling

Metrics Server was absent, then failed because the local kubelet certificate
lacked IP SANs. A local-only TLS-verification exception allowed collection. This
is not a production certificate strategy. Windows editor/quoting issues were
avoided by applying a saved strategic-merge patch file.

kubectl top reports recent CPU/memory. 1m means 0.001 CPU core; Mi is mebibytes.
HPA watches CPU and requests 2–4 app Pods around 50% of 100m requests. A two-minute
HTTP test raised CPU and demonstrated scale-out; scale-in was delayed. HPA does
not count visitors directly, scale MySQL automatically, or fix every bottleneck.

## 14. Backups and actual cluster recovery

We exported todos with mysqldump, copied the backup outside Git, restored it into
another database, and counted three rows. Later the local cluster/context was
missing after restart; the old node container was absent, but the reason was not
established. The backup survived. We recreated infrastructure, root Secret,
MySQL, restored data, recreated app user/Secret, and deployed the app. Then we
restored metrics and HPA. Only tasks present at backup time could be recovered.

This distinguished four assets: Git manifests, Secret values, database backups,
and local certificate trust. None replaces the others.

## 15. Introduce GitOps with Argo CD

We installed Argo in its own namespace, accessed its dashboard, and replaced
temporary port forwarding with a dashboard LoadBalancer on 8083. We created an
Application reading the personal fork's main/k8s into namespace default and
excluded legacy pvc.yaml. Dashboard infrastructure was moved outside k8s;
a duplicate file was removed through a PR without deleting the live Service.

The first diff mostly added Argo tracking annotations. Manual Sync adopted the
existing resources; Synced meant matching Git and Healthy meant resource health.
An old ReplicaSet in the graph is normal rollout history, not another active app.

We then saved the Application definition under infrastructure/argocd and applied
it once, enabling automated sync with pruning/self-heal false. Its location is
outside its own source path, so changes to that Application file still require
explicit administration unless a parent GitOps application is introduced.
We verified auto-sync through a Pod-template annotation applied without a manual
Sync or kubectl apply. An annotation change creates a new rollout, even if the
container image is unchanged.

## 16. Redesign the frontend as Clear Day

The UI was replaced with a responsive task workspace: add, toggle, delete,
search, all/active/completed views, counts, progress, and errors. Login was
explicitly deferred. Active UI no longer imports old Bootstrap components or
external fonts. Existing API/data schema stayed compatible; no migration was
needed. A standalone preview was tested before publishing through CI.

The Clear Day code merge produced the image tag used in deployment, not the
older GitOps metadata commit shown on a stale package page. A separate reviewed
image-tag change then triggered Argo's rollout while preserving MySQL tasks.

## 17. Ingress, certificates, redirect, and internal Service

We installed Helm, reopened VS Code for PATH, and installed Traefik chart
42.4.1 / app v3.7.19. Ingress connected clearday.localhost to Service port 8082
(not container port 3000). We tested HTTP before adding TLS.

mkcert installed a local CA, generated a certificate/private key outside Git,
and Kubernetes stored them as clearday-tls. Ingress selected websecure and the
TLS Secret. Helm values configured HTTP -> HTTPS permanent redirect. Windows
curl initially failed a revocation check; best-effort revocation succeeded
without skipping hostname/trust validation. Browser restart resolved its trust
state. We verified HTTP 308 and HTTPS 200, then changed the app's LoadBalancer
to ClusterIP so direct localhost:8082 no longer bypassed Traefik.

Current lesson boundary: infrastructure Helm changes are manually administered;
app manifests auto-sync from Git. No public DNS, public CA, account login,
central monitoring dashboards, vulnerability scanning, or cloud deployment has
been implemented by these lessons.

## Review questions

1. Why can a new image in GHCR coexist with an old running UI?
2. Why can Running and 0/1 ready occur together?
3. What survives Pod deletion, and what survives whole-cluster loss?
4. Why does changing a Secret not reset MySQL's stored password?
5. What does HPA's 50% measure?
6. Why is Helm Traefik configuration outside the app's GitOps path?
7. Why does HTTPS not make this app private?
8. Which two reviewed changes normally move new source code into the cluster?

Answers are in [architecture](architecture.md), [operations](operations.md), and
[recovery](recovery.md). Repeat exercises only on disposable local data and
restore any deliberate outages promptly.
