# Backups and disaster recovery

[Documentation home](../README.md) · [Setup](setup.md)

## What each saved asset can recover

| Asset | Recovers | Does not recover |
| --- | --- | --- |
| Git repository | App source, manifests, docs, image references | Secret values or todos |
| GHCR image | Built app version | Live database or environment |
| MySQL PVC | Data across Pod replacement | Reliable protection against cluster/disk loss or deleted rows |
| SQL backup | Data/schema captured at backup time | Later tasks, MySQL system users, Kubernetes resources |
| Password records | Credentials needed for accounts | Database contents |
| Local certificate/key and CA trust | Local HTTPS identity/trust | App data or a public certificate |

Keep database backups and keys outside Git with appropriate access controls.
An additional protected off-device backup is needed for laptop loss. Backup
success must include a test restore, not just a nonzero file size.

## 1. Create a fresh SQL backup

Run against the intended local MySQL. The command uses the container's existing
root credential in an environment variable without printing it. This is a local
learning method; environment credentials remain visible to sufficiently
privileged processes. Stop if any command fails.

```powershell
kubectl --context docker-desktop exec deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysqldump -u root --single-transaction --no-tablespaces todos > /tmp/todos-backup.sql'
```

The consistent transaction applies to transactional tables; avoid schema changes
during backup. The in-container file alone is not safe against Pod/node loss.
Use a unique host filename so previous good backups are retained:

```powershell
New-Item -ItemType Directory -Force C:\Users\Pabasara\Documents\Codex_\backups
$backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$mysqlPod = kubectl --context docker-desktop get pods -l app=todo-mysql -o jsonpath='{.items[0].metadata.name}'
Push-Location C:\Users\Pabasara\Documents\Codex_\backups
kubectl --context docker-desktop cp "${mysqlPod}:/tmp/todos-backup.sql" "./todos-$backupStamp.sql"
Get-Item "./todos-$backupStamp.sql" | Select-Object Name,Length,LastWriteTime
Pop-Location
```

Relative local paths avoid kubectl cp confusing a Windows drive colon with a
remote separator. cp requires a Pod name, not deployment/todo-mysql. It uses tar
in the container; this MySQL image supported it in our exercise.

The earlier lesson piped cat to Set-Content -Encoding UTF8. That restored three
rows successfully, but PowerShell can transcode text/newlines. Prefer kubectl cp
for byte-preserving transfer of future dumps. Do not overwrite the only good
backup when changing techniques.

## 2. Test a backup without touching live todos

Choose a known backup file. The example uses the original lesson snapshot,
todos-backup.sql. Copy into the current MySQL Pod:

```powershell
$mysqlPod = kubectl --context docker-desktop get pods -l app=todo-mysql -o jsonpath='{.items[0].metadata.name}'
Push-Location C:\Users\Pabasara\Documents\Codex_\backups
kubectl --context docker-desktop cp ./todos-backup.sql "${mysqlPod}:/tmp/todos-restore.sql"
Pop-Location
```

Create a separate practice database. Importing can replace its tables; do not
use this database for unrelated data:

```powershell
'CREATE DATABASE IF NOT EXISTS todos_restore_test;' | kubectl --context docker-desktop exec -i deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root'
kubectl --context docker-desktop exec deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos_restore_test < /tmp/todos-restore.sql'
'SELECT COUNT(*) AS restored_tasks FROM todo_items;' | kubectl --context docker-desktop exec -i deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos_restore_test'
```

The original November 15 snapshot was 2,186 bytes and restored three tasks.
Future snapshots have different sizes/counts. Count alone is not full integrity
verification: privately verify representative task names/completion flags too,
without sharing the backup contents. App still uses todos, not the test database.
Its dump did not use --databases, so it imports into the explicitly selected DB;
inspect the provenance/options before restoring an unrelated dump that may
contain USE statements.

## 3. Diagnose a missing cluster before recreating

Normal restart: open Docker Desktop, wait for engine and Kubernetes, then:

```powershell
docker info
kubectl config get-contexts docker-desktop
kubectl --context docker-desktop get nodes
```

If Ready, inspect existing Pods/PVCs rather than reinstalling:

```powershell
kubectl --context docker-desktop get pods,pvc
```

If Desktop offers only Create cluster and context is missing:

```powershell
docker ps -a
docker volume ls
Get-Item C:\Users\Pabasara\Documents\Codex_\backups\todos-backup.sql
```

Do not delete containers/volumes or reset while investigating. In the actual
lesson the old kind node container was absent; the cause was not determined.
Separate Compose/standalone volumes survived but were not the Kubernetes DB.
The saved SQL snapshot enabled recovery. A restart alone does not establish
that Kubernetes normally deletes its data.

## 4. Rebuild a genuinely unavailable local cluster

Follow this dependency order, using the detailed commands in [setup](setup.md):

1. Create a one-node local kind cluster; verify Ready.
2. Check out intended, reviewed source/configuration. Do not discard local work.
3. Recreate todo-mysql-secret with a root password suitable for the database.
4. Apply mysql-pvc.yaml and mysql.yaml; wait for final MySQL on 3306.
5. Restore the SQL dump into the fresh todos database (next section).
6. Recreate todo_app and privileges; create matching todo-app-db-secret.
7. Restore Metrics Server and the local-only TLS patch if required.
8. Restore Traefik with chart version and saved redirect values.
9. Recreate clearday-tls from protected certificate/key files, or issue new leaf
   files using the trusted local CA if necessary.
10. Restore ConfigMap, app Deployment, ClusterIP Service, Ingress, and HPA.
11. Install Argo CD/dashboard if missing; review and apply its Application
    definition. Remember it enables automatic synchronization.
12. Verify health, restored tasks, CRUD, metrics/HPA, HTTPS, and GitOps status.

Secrets, MySQL system users, metrics infrastructure, certificate trust, and
Traefik are not magically recreated by app GitOps. If GHCR is private, also
provision the required image pull credentials. Avoid blindly applying k8s/
because it includes the historical SQLite claim.

## 5. Restore into the fresh live database

Only after confirming this is the intended new database with no newer data,
copy the selected backup as above, then:

```powershell
kubectl --context docker-desktop exec deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos < /tmp/todos-restore.sql'
'SELECT COUNT(*) AS restored_tasks FROM todo_items;' | kubectl --context docker-desktop exec -i deployment/todo-mysql -- sh -c 'export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; mysql -u root todos'
```

Do not run a live restore casually: dumps can drop/recreate tables and overwrite
newer tasks. Coordinate an outage, capture a fresh backup first, and prevent app
writes if restoring an already operating system. GitOps/HPA can undo casual
manual scaling, so a controlled maintenance plan is needed beyond this fresh
cluster exercise. Restore is not a rolling update or an image rollback.

The dump contains app schema/data, not todo_app permissions. Recreate them as in
setup. If an existing account password differs from the newly entered Secret,
correct the SQL account and runtime Secret together and restart affected app
Pods through the reviewed procedure. Recreating the root initialization Secret
does not reset credentials stored in a surviving database volume.

## 6. Acceptance and recovery limits

```powershell
kubectl --context docker-desktop get pods,service,pvc,hpa,ingress
kubectl --context docker-desktop -n argocd get application todo-app
kubectl --context docker-desktop top pods
curl.exe --ssl-revoke-best-effort https://clearday.localhost/api/health/ready
```

Confirm browser trust and expected tasks. Add/complete/delete a disposable task.
Verify app logs show MySQL, not accidental SQLite fallback. Only data present at
backup time is recoverable from that snapshot. Keep the original backup until
restoration is verified and a new recovery point is protected.

This runbook was checked against source and the successful lesson transcript;
it was not executed end-to-end again while documenting. No scheduled backups,
off-device backup automation, point-in-time recovery, MySQL replication, or
multi-node disaster-recovery system has been implemented.
