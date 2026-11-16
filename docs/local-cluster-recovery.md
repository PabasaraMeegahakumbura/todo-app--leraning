# Recover the local Kubernetes learning environment

Run these commands in PowerShell from the repository root. Every Kubernetes
command explicitly targets `docker-desktop`. These instructions do not operate
on other saved cluster contexts.

## 1. Diagnose before recreating

A normal laptop restart should not require deleting a cluster. Open Docker
Desktop and wait for its engine and Kubernetes to start. Do not reset/delete
the cluster or prune containers/volumes while investigating.

```powershell
docker info
kubectl config get-contexts docker-desktop
kubectl --context docker-desktop get nodes
```

If the node is Ready, inspect existing resources instead of recreating them:

```powershell
kubectl --context docker-desktop get pods
kubectl --context docker-desktop get pvc
```

If the context is absent and Desktop offers only Create cluster, inspect:

```powershell
docker ps -a
docker volume ls
Get-Item C:\Users\Pabasara\Documents\Codex_\backups\todos-backup.sql
```

In our recovery, the old Kubernetes node container was absent. The cause was
not established. Compose and standalone app volumes remained, but those were
separate databases, not the Kubernetes MySQL volume.

## 2. Recreate only when the old cluster is unavailable

In Docker Desktop, create a kind cluster with one node (our tested Kubernetes
version was 1.36.1). Wait until this reports Ready:

```powershell
kubectl --context docker-desktop get nodes
```

Git restores configuration, not Secret values, database contents, or manually
created MySQL users. Review the checked-out manifests and image tag before use.
Do not blindly apply the entire k8s directory: it also contains a legacy SQLite
PVC, and the HPA needs metrics to function.

## 3. Recreate the root Secret

For a new, empty MySQL volume, choose a new learning-only password. For an
existing database volume, use its existing password: changing this Secret does
not change passwords already stored in MySQL.

```powershell
$rootPassword = Read-Host "MySQL root password" -AsSecureString
$rootCredential = [System.Net.NetworkCredential]::new("", $rootPassword)
$rootSecret = @{
    apiVersion = "v1"
    kind = "Secret"
    metadata = @{ name = "todo-mysql-secret" }
    type = "Opaque"
    stringData = @{ "mysql-root-password" = $rootCredential.Password }
} | ConvertTo-Json -Depth 5
$rootSecret | kubectl --context docker-desktop create -f -
Remove-Variable rootPassword, rootCredential, rootSecret
```

Use this on the fresh cluster only. If the Secret already exists, stop and
inspect the recovery state rather than deleting it. Password text temporarily
exists in process memory; clearing variables is not secure memory erasure.
Never commit Secret values or backup contents. Base64 is not encryption.

## 4. Start MySQL

```powershell
kubectl --context docker-desktop apply -f k8s/mysql-pvc.yaml
kubectl --context docker-desktop apply -f k8s/mysql.yaml
kubectl --context docker-desktop rollout status deployment/todo-mysql --timeout=360s
kubectl --context docker-desktop logs deployment/todo-mysql --tail=20
```

Wait for the final server to accept connections on port 3306. The temporary
initialization server starting and stopping is normal on an empty volume.

## 5. Restore the SQL backup into the fresh database

This imports table definitions and data and can replace existing tables. Use
it only for the intended fresh recovery database, not a live database with
newer data. Stop after any failed command; do not continue to the next stage.

```powershell
$mysqlPod = kubectl --context docker-desktop get pods -l app=todo-mysql -o jsonpath='{.items[0].metadata.name}'
Push-Location C:\Users\Pabasara\Documents\Codex_\backups
kubectl --context docker-desktop cp ./todos-backup.sql "${mysqlPod}:/tmp/todos-restore.sql"
Pop-Location

kubectl --context docker-desktop exec deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos < /tmp/todos-restore.sql'

'SELECT COUNT(*) AS restored_tasks FROM todo_items;' | kubectl --context docker-desktop exec -i deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos'
```

`kubectl cp` needs a Pod name, not `deployment/todo-mysql`. A relative local
path avoids Windows drive-letter parsing problems. These commands use the
container's root password without printing it. The environment variable is
still a credential and is appropriate only for this controlled local exercise.

Our November 15, 2026 backup restored three tasks. Later changes are not in
that snapshot. A PVC survives Pod replacement, but it is not a backup; a backup
on this laptop also does not protect against losing the laptop.

## 6. Recreate the application database account

The todo database dump does not restore MySQL user accounts.

```powershell
kubectl --context docker-desktop exec -it deployment/todo-mysql -- mysql -u root -p
```

At `mysql>`, replace the password placeholder before executing:

```sql
CREATE USER 'todo_app'@'%' IDENTIFIED BY 'REPLACE_WITH_A_NEW_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON todos.* TO 'todo_app'@'%';
SHOW GRANTS FOR 'todo_app'@'%';
exit;
```

Use a distinct learning-only password without a single quote for this SQL
exercise. CREATE is required because the backend initializes its table. If you
accidentally used the placeholder, use `ALTER USER ... IDENTIFIED BY ...` with
your chosen password before creating the Kubernetes Secret. Do not share SQL
history containing real passwords.

In PowerShell, enter that same application password:

```powershell
$appPassword = Read-Host "todo_app password" -AsSecureString
$appCredential = [System.Net.NetworkCredential]::new("", $appPassword)
$appSecret = @{
    apiVersion = "v1"
    kind = "Secret"
    metadata = @{ name = "todo-app-db-secret" }
    type = "Opaque"
    stringData = @{ password = $appCredential.Password }
} | ConvertTo-Json -Depth 5
$appSecret | kubectl --context docker-desktop create -f -
Remove-Variable appPassword, appCredential, appSecret
```

## 7. Restore the application

```powershell
kubectl --context docker-desktop apply -f k8s/configmap.yaml
kubectl --context docker-desktop apply -f k8s/deployment.yaml
kubectl --context docker-desktop apply -f k8s/service.yaml
kubectl --context docker-desktop rollout status deployment/todo-app --timeout=180s
kubectl --context docker-desktop get pods
kubectl --context docker-desktop get service todo-app
Invoke-RestMethod http://localhost:8082/api/health/ready
```

Confirm readiness returns `ready`, the browser shows the recovered tasks, and
adding/completing/deleting a disposable task works. A brief connection failure
can occur while local Service routing updates; retry after checking readiness.
For failures, inspect Pod events and app logs rather than resetting the cluster.

## 8. Restore metrics and autoscaling

The versioned installation used in this lesson:

```powershell
kubectl --context docker-desktop apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.8.1/components.yaml
```

Our local kubelet certificate lacked IP SANs. Only for this local learning
cluster, create a patch that skips kubelet certificate verification. Traffic
remains encrypted, but the server identity is not verified. Production should
use valid serving certificates instead.

```powershell
@'
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
'@ | Set-Content -Encoding ASCII C:\Users\Pabasara\Documents\Codex_\metrics-server-local-patch.yaml

kubectl --context docker-desktop -n kube-system patch deployment metrics-server --type strategic --patch-file C:\Users\Pabasara\Documents\Codex_\metrics-server-local-patch.yaml
kubectl --context docker-desktop -n kube-system rollout status deployment/metrics-server --timeout=120s
kubectl --context docker-desktop top pods
```

Allow another 30–60 seconds for initial metrics. If unavailable:

```powershell
kubectl --context docker-desktop get apiservice v1beta1.metrics.k8s.io
kubectl --context docker-desktop -n kube-system logs deployment/metrics-server --tail=15
```

Once metrics work:

```powershell
kubectl --context docker-desktop apply -f k8s/hpa.yaml
kubectl --context docker-desktop get hpa todo-app
```

Expected HPA range is 2–4 app Pods, targeting 50% of their CPU request. MySQL
stays at one replica. The current checked-in Deployment may still specify
`replicas: 2`; when using HPA, review removing that field in a separate change
so future manifest applies do not reset the HPA-managed count.

## Recovery checklist and next lesson

- Local node Ready; MySQL and app Pods ready.
- Expected backup task count restored and app CRUD operations verified.
- Secret values remain outside Git; passwords match the actual MySQL users.
- Metrics API available; HPA receives CPU metrics.
- Desired app image tag matches the verified published image.

This guide documents the recovery performed in the lesson; the guide itself
has not been executed as an automated recovery test. The next milestone is
GitOps: a controller reconciles reviewed Git manifests into the local cluster.
Database backups and Secret provisioning remain separate responsibilities.
