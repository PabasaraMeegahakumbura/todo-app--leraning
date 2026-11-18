# Troubleshooting by symptom

[Documentation home](../README.md) · [Operations](operations.md)

Read the exact error first. A timeout is a symptom, not a diagnosis. Avoid
reinstalling everything, changing multiple variables at once, or deleting data
to make an error disappear. Do not share passwords, Secret YAML, keys, or dumps.

## Command not recognized: Helm or mkcert

Installation can succeed while an existing terminal still has old PATH. Close
all VS Code windows, reopen, and retry the version command. Reinstalling or
restarting the laptop is usually unnecessary. If missing, follow setup.md.

## Cannot find a file

```powershell
Get-Location
Test-Path ./k8s/ingress.yaml
```

`./` means current directory. Distinguish workspace root, repository root, k8s,
and infrastructure folders. Saving an editor tab is required before apply/build.
An absolute path under the workspace is not the same as a file saved in k8s.

## No objects passed to apply / ConfigMap missing

The file may be empty, unsaved, or contain no resource documents. Check content.
A Deployment referencing a nonexistent ConfigMap/Secret may fail container
configuration and time out. Create the missing prerequisite first; inspect Pod
Events. Never paste Secret content to diagnose it.

## CI fails: duplicate strategy or unknown replica

YAML mappings cannot repeat the same key. Keep one strategy under the outer
Deployment spec. `replicas` is the valid field; `replica` is not. Strict
Kubeconform intentionally rejects these errors. Commit/push the fix on the same
feature branch; do not open another branch for each correction. The deployed
cluster is not altered by a failing CI check.

## GitHub says nothing to compare

Do not compare main with itself. Compare the actual pushed feature branch with
the fork's main. Check `git branch --show-current`; instructions may name a branch
you did not switch to. If already merged or changes cancel out, no new PR is
needed. Review a diff rather than inventing a commit to force a PR.

## PR accidentally targets Docker's repository

Close the unmerged PR; it does not change Docker code. Closing does not erase
the public record. Create the intended PR inside the fork, with fork main as
base. Deleting a branch does not erase PR contents. If real credentials were
exposed, revoke/rotate them first; closing a PR is not credential removal.

## ImagePullBackOff or wrong greeting/UI

```powershell
kubectl --context docker-desktop describe pod -l app=todo-app
kubectl --context docker-desktop get deployment todo-app -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl --context docker-desktop get pods -l app=todo-app -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image'
Select-String -Path k8s/deployment.yaml -Pattern 'image:'
```

Check full tag, successful main publishing run, package visibility/access, and
the desired Git revision. An old but valid image can roll out successfully.
Tag comes before `: digest` in push logs, not the following sha256 value.
Do not infer source version from a stale package page's Latest label.

If ConfigMap GREETING is correct but the API returns a fixed old string, the
image may predate environment-variable support. Current UI does not display
GREETING; test /api/greeting separately. If the API/data are correct but assets
look stale, reload with Ctrl+F5 after checking the actual Pod image.

## Running but unready / app rollout timeout

```powershell
kubectl --context docker-desktop get pods
kubectl --context docker-desktop describe pod -l app=todo-app
kubectl --context docker-desktop logs -l app=todo-app --tail=20 --prefix=true
kubectl --context docker-desktop get endpointslices -l kubernetes.io/service-name=todo-app
```

Running means the process started; readiness can still fail. Check missing
Secrets, incorrect DB credentials, DB readiness, permission errors, image pull,
scheduling resources, or wrong probe path. A two-second readiness handler needs
more than a one-second probe timeout; current manifest uses three seconds.
Transient route updates can briefly close a connection; retry after checking
Pod readiness, not by immediately rebuilding everything.

## MySQL access denied

The SQL user's password and app Secret must match. The root Secret belongs to
MySQL initialization; the app Secret belongs to todo_app. Confirm user grants
privately through a root session. CREATE permission is needed for startup table
initialization. Changing MYSQL_ROOT_PASSWORD in a Secret does not rewrite an
existing MySQL account. Do not delete the PVC to reset a password.

## Metrics API not available

```powershell
kubectl --context docker-desktop -n kube-system get pods -l k8s-app=metrics-server
kubectl --context docker-desktop -n kube-system logs deployment/metrics-server --tail=20
kubectl --context docker-desktop get apiservice v1beta1.metrics.k8s.io
```

If missing, install Metrics Server. If x509 says no IP SANs, use the documented
local-only patch after diagnosis. A rollout timeout alone does not justify TLS
bypass. If a manual editor change was cancelled, inspect args to confirm it:

```powershell
kubectl --context docker-desktop -n kube-system get deployment metrics-server -o jsonpath='{.spec.template.spec.containers[0].args}'
```

After ready, wait 30–60 seconds for collection. APIService should be available.
If PowerShell/VS Code editing becomes confusing, a saved strategic merge patch
avoids command-line JSON escaping. Ctrl+C cancels the watcher/editor command,
not the cluster. Typing y at a fresh PowerShell prompt tries to execute y.

## HPA unknown or not scaling

Check Metrics Server, CPU requests, HPA describe conditions, and sustained CPU
load. Lightweight endpoints may not reach the target. HPA is not visitor-count
scaling. Delayed scale-down is normal. The checked-in replicas: 2 is a known
ownership issue to remove in a separate reviewed change, not a reason to delete
the HPA. MySQL remains single-instance regardless of app scale.

## NodePort created but localhost fails

Docker Desktop kind networking does not guarantee node ports are published to
Windows localhost. We first used a LoadBalancer Service; the final design uses
Traefik's LoadBalancer and app ClusterIP. Do not expect the old direct 8082 route
to remain after internalizing the app Service.

## Argo Healthy but OutOfSync

Health and configuration agreement are different. Inspect Diff. Initial adoption
can add tracking annotations without application changes. Check for real image,
replica, storage, or env differences. If a dashboard Service appears among app
resources, remove its duplicate from k8s through a PR, keeping infrastructure's
copy. File deletion in Git is not a kubectl delete; keep prune off.

Synced at a newer Git revision with an older Last Sync can be normal when no
managed manifests changed. To verify a rollout test, read its Pod-template
annotation directly. Argo's Application definition is outside its own path, so
editing that file does not automatically reconfigure the controller.

## Kubernetes context missing after reboot

Open Docker Desktop and wait. Inspect node/container/volume state before reset.
A missing context does not prove all data is deleted. Follow recovery.md if the
old cluster truly cannot be recovered. The surviving Compose volume is a
different database, not a substitute Kubernetes backup.

## HTTP redirect or HTTPS problem

```powershell
curl.exe -I http://clearday.localhost
curl.exe -I https://clearday.localhost
kubectl --context docker-desktop get ingress todo-app
kubectl --context docker-desktop -n traefik get pods,service
kubectl --context docker-desktop get secret clearday-tls
```

HTTP should return 308 and a Location header for HTTPS. TLS Secret should have
type kubernetes.io/tls and DATA 2. Do not print its data. Check hostname SAN,
validity, trusted issuer, and whether Traefik presents the expected certificate.
Common Name absent is not by itself an error; modern hostname identity is in SAN.

For the observed Windows error CRYPT_E_NO_REVOCATION_CHECK:

```powershell
curl.exe --ssl-revoke-best-effort -I https://clearday.localhost
```

This tolerates missing/offline revocation information for this request while
retaining trust/hostname verification. Do not use -k as a permanent fix. Browser
trust is a separate check: fully close/reopen after mkcert installs the CA, open
the exact HTTPS address, and inspect Security details for persistent warnings.
Do not regenerate certificates without identifying the actual failure. An Argo
dashboard certificate warning is separate from the Clear Day hostname.

## Port conflict, backup copy, and editor output

Docker ps shows published ports; Kubernetes Services may also own host listeners.
Stop any old port-forward before using the same local port in a LoadBalancer.
Compose proxy and Kubernetes Traefik both want 80. Preserve volumes when stopping.

kubectl cp requires a Pod name; use a relative local path to avoid the Windows
drive colon. Read-only secret describe reveals keys/sizes; get -o yaml reveals
encoded credentials. Never post those exports or private certificate keys in
screenshots. A tool's permission failure reading an attachment is not evidence
that Kubernetes failed: paste only the relevant non-secret diagnostic lines.
