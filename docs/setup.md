# Local setup and infrastructure

[Documentation home](../README.md) · [Recovery](recovery.md)

## Before starting

This is a recreation guide, not a script to rerun over a healthy installation.
Use PowerShell from the repository root. Stop after any failed command. Preserve
uncommitted work. Never reset a cluster or delete volumes merely to retry setup.

Required: Git, Docker Desktop with Linux containers and Kubernetes, kubectl,
Helm, mkcert, and access to the fork. VS Code is the optional editor. Docker
builds supply Node.js; a host Node installation is not required.

The observed lesson versions were Kubernetes 1.36.1, Helm 4.3.2, MySQL 9.3,
Metrics Server 0.8.1, and Traefik chart 42.4.1/app 3.7.19. These are recorded
versions, not a claim that they are always the newest releases.

```powershell
git --version
docker info
kubectl version --client
helm version --short
mkcert -version
```

Docker must return a Server section. If Helm/mkcert are missing:

```powershell
winget install --exact --id Helm.Helm
winget install --exact --id FiloSottile.mkcert
```

Reopen all VS Code windows to refresh PATH after installation.

## 1. Source and cluster

Reuse the existing checkout or clone your own fork. Verify origin points to the
fork; upstream, if configured, points to Docker's original. Inspect before pull:

```powershell
git status
git remote -v
```

For a new local cluster, Docker Desktop -> Kubernetes -> kind -> one node.
For an existing cluster, wait for startup instead of recreating it.

```powershell
kubectl --context docker-desktop get nodes
```

Continue at Ready. Every command in these guides explicitly targets the local
context. There is no need to inspect unrelated contexts.

## 2. Runtime Secrets

Git stores references, never real passwords. Three Secrets are needed:

| Namespace/name | Key | Consumer |
| --- | --- | --- |
| default/todo-mysql-secret | mysql-root-password | MySQL initialization |
| default/todo-app-db-secret | password | App database login |
| default/clearday-tls | tls.crt and tls.key | Traefik TLS |

On a fresh cluster, create root credentials directly through standard input:

```powershell
$rootPassword = Read-Host "Choose MySQL root password" -AsSecureString
$rootCredential = [System.Net.NetworkCredential]::new("", $rootPassword)
$rootSecret = @{
    apiVersion = "v1"
    kind = "Secret"
    metadata = @{ name = "todo-mysql-secret"; namespace = "default" }
    type = "Opaque"
    stringData = @{ "mysql-root-password" = $rootCredential.Password }
} | ConvertTo-Json -Depth 5
$rootSecret | kubectl --context docker-desktop create -f -
Remove-Variable rootPassword, rootCredential, rootSecret
```

AlreadyExists means inspect the existing state, not delete the Secret. Clearing
variables does not guarantee secure memory erasure. Base64 is not encryption.
Existing MySQL data directories keep stored passwords: changing an initialization
Secret does not reset the database password. Retain credentials privately.

## 3. MySQL and app account

```powershell
kubectl --context docker-desktop apply -f k8s/mysql-pvc.yaml
kubectl --context docker-desktop apply -f k8s/mysql.yaml
kubectl --context docker-desktop rollout status deployment/todo-mysql --timeout=360s
kubectl --context docker-desktop logs deployment/todo-mysql --tail=20
```

Expect the final server ready on 3306. A temporary initialization server starting
and stopping is normal. For recovery, restore SQL before starting app traffic.

```powershell
kubectl --context docker-desktop exec -it deployment/todo-mysql -- mysql -u root -p
```

Enter root's password. At mysql>, replace the placeholder BEFORE executing:

```sql
CREATE USER 'todo_app'@'%' IDENTIFIED BY 'REPLACE_WITH_YOUR_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON todos.* TO 'todo_app'@'%';
SHOW GRANTS FOR 'todo_app'@'%';
exit;
```

Use a different learning-only password without a single quote for this SQL
exercise. Protect SQL history containing passwords. CREATE is needed for the
backend's startup table initialization. If the user already exists, investigate;
use ALTER USER to correct its password deliberately. No FLUSH PRIVILEGES is needed.

In PowerShell enter the SAME app password, creating its separate Secret:

```powershell
$appPassword = Read-Host "Enter todo_app password" -AsSecureString
$appCredential = [System.Net.NetworkCredential]::new("", $appPassword)
$appSecret = @{
    apiVersion = "v1"
    kind = "Secret"
    metadata = @{ name = "todo-app-db-secret"; namespace = "default" }
    type = "Opaque"
    stringData = @{ password = $appCredential.Password }
} | ConvertTo-Json -Depth 5
$appSecret | kubectl --context docker-desktop create -f -
Remove-Variable appPassword, appCredential, appSecret
```

## 4. Metrics and autoscaling prerequisites

```powershell
kubectl --context docker-desktop apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.8.1/components.yaml
kubectl --context docker-desktop -n kube-system logs deployment/metrics-server --tail=20
```

Our local kubelet certificate lacked IP SANs. Only if that error recurs, save the
following as a local patch outside the app GitOps directory:

```yaml
spec:
  template:
    spec:
      containers:
        - name: metrics-server
          args:
            - --cert-dir=/tmp
            - --secure-port=10250
            - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
            - --kubelet-use-node-status-port
            - --metric-resolution=15s
            - --kubelet-insecure-tls
```

The lesson path was C:\Users\Pabasara\Documents\Codex_\metrics-server-local-patch.yaml.

```powershell
kubectl --context docker-desktop -n kube-system patch deployment metrics-server --type strategic --patch-file C:\Users\Pabasara\Documents\Codex_\metrics-server-local-patch.yaml
kubectl --context docker-desktop -n kube-system rollout status deployment/metrics-server --timeout=120s
kubectl --context docker-desktop top pods
```

Allow 30–60 seconds for samples. This exception skips kubelet server identity
verification; it is local-development guidance, not production certificate setup.

## 5. Traefik infrastructure

Ensure the Compose proxy is not occupying port 80. Run from the repository root:

```powershell
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik --version 42.4.1 --namespace traefik --create-namespace --kube-context docker-desktop -f infrastructure/traefik/values.yaml --wait --timeout 5m
kubectl --context docker-desktop -n traefik get pods,service
kubectl --context docker-desktop get ingressclass
```

Helm owns this installation. App Argo CD does not watch the Helm values file.
Its HTTP redirect affects all routes using Traefik's web entry point.

## 6. Local HTTPS

mkcert -install changes the local trust store and may prompt for approval:

```powershell
mkcert -install
New-Item -ItemType Directory -Force C:\Users\Pabasara\Documents\Codex_\certificates
mkcert -cert-file C:\Users\Pabasara\Documents\Codex_\certificates\clearday.pem -key-file C:\Users\Pabasara\Documents\Codex_\certificates\clearday-key.pem clearday.localhost
kubectl --context docker-desktop -n default create secret tls clearday-tls --cert=C:\Users\Pabasara\Documents\Codex_\certificates\clearday.pem --key=C:\Users\Pabasara\Documents\Codex_\certificates\clearday-key.pem
kubectl --context docker-desktop -n default get secret clearday-tls
```

The TLS Secret has DATA 2. Keep leaf private keys outside Git. The mkcert CA
private key is especially sensitive: never copy it into Kubernetes or share it.
Traefik needs the leaf certificate/key, not the CA key. Existing valid files can
recreate a lost Secret on the same computer without generating another CA.
Other devices do not automatically trust this local CA.

## 7. Argo CD bootstrap

The original lesson used official stable manifests. That URL moves; it is not a
pinned recovery version. For stricter reproducibility, record/review a specific
supported release before installing. This reproduces the lesson's method:

```powershell
kubectl --context docker-desktop create namespace argocd
kubectl --context docker-desktop apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl --context docker-desktop -n argocd get pods
```

Namespace AlreadyExists alone is harmless. Stop on apply conflicts rather than
adding force flags blindly. Wait for the controller StatefulSet and other Pods
to be ready. Then create persistent dashboard access:

```powershell
kubectl --context docker-desktop apply -f infrastructure/argocd/argocd-dashboard-service.yaml
kubectl --context docker-desktop -n argocd get service argocd-dashboard
```

Open https://localhost:8083. This administrative endpoint has separate certificate
behavior; clearday.localhost's certificate does not cover it. For the initial
admin password, only before it has been changed:

```powershell
$argoPassword = kubectl --context docker-desktop -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($argoPassword))
Remove-Variable argoPassword
```

Do not share output. Change the initial password in User Info. Keep dashboard
access on a trusted local network, not a publicly forwarded port.

## 8. Application bootstrap and GitOps adoption

With database users, passwords, TLS Secret, and infrastructure ready, manually
bootstrap these app resources if they do not already exist:

```powershell
kubectl --context docker-desktop apply -f k8s/configmap.yaml
kubectl --context docker-desktop apply -f k8s/deployment.yaml
kubectl --context docker-desktop apply -f k8s/service.yaml
kubectl --context docker-desktop apply -f k8s/ingress.yaml
kubectl --context docker-desktop apply -f k8s/hpa.yaml
kubectl --context docker-desktop rollout status deployment/todo-app --timeout=180s
```

Do not apply the directory blindly; it contains an unused legacy SQLite PVC.
Review Git desired state before applying the current Application definition:

```powershell
kubectl --context docker-desktop apply -f infrastructure/argocd/todo-application.yaml
kubectl --context docker-desktop -n argocd get application todo-app
```

This enables automatic reconciliation immediately, with pruning/self-heal off.
Argo watches main/k8s, excludes pvc.yaml, and deploys to default in its own local
cluster. The original adoption exercise began with manual sync and reviewed
tracking-annotation differences; it was then explicitly switched to automated.
Public source/images need no pull login; private ones need separate credentials.

## 9. Acceptance checks

```powershell
kubectl --context docker-desktop get pods,service,pvc,hpa,ingress
curl.exe -I http://clearday.localhost
curl.exe --ssl-revoke-best-effort -I https://clearday.localhost
```

Expect HTTP 308 to HTTPS and HTTPS 200. The curl option handles unavailable local
CA revocation information without skipping trust/hostname checks. Confirm browser
trust too, then test add/complete/delete. Direct localhost:8082 should no longer
serve the app: the app Service is ClusterIP. Follow [operations](operations.md)
for future releases, not repeated manual applies after GitOps adoption.
