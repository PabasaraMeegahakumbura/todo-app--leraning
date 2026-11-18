# Technical glossary

[Documentation home](../README.md)

## Application and networking

| Term | Plain meaning and project example |
| --- | --- |
| Frontend | Browser interface; React displays Clear Day tasks |
| Backend | Server logic; Express handles /api/items |
| API | Defined HTTP interface through which software communicates |
| Endpoint | One API address/method, such as GET /api/health/ready |
| CRUD | Create, read, update, delete; the four task-data operations |
| JSON | Structured text used for API request/response data |
| State | Current values; React state is a view, database state is durable |
| Environment variable | Startup setting such as MYSQL_HOST or GREETING |
| Hostname | Name used to reach a host/service, such as clearday.localhost |
| Port | Number identifying a network listener; Express uses 3000 |
| DNS | Translates names into addresses; cluster DNS resolves todo-mysql |
| Reverse proxy | Receives client requests and forwards them to a backend |
| HTTP | Web request/response protocol without TLS protection |
| HTTPS | HTTP carried over TLS |
| TLS | Encrypts the connection and verifies peer identity using certificates |
| SSL | Older predecessor; often used informally to mean TLS |
| Certificate | Public identity document containing a hostname/public key |
| Private key | Secret used to prove certificate ownership; never commit |
| CA | Certificate authority that signs certificates |
| SAN | Subject Alternative Name; hostnames/IPs a certificate covers |
| TLS termination | Traefik handles HTTPS, then forwards internal HTTP |
| Revocation | Invalidating a certificate before its normal expiration |
| 308 redirect | Permanent instruction to request another URL; HTTP to HTTPS here |

## Git and delivery

| Term | Plain meaning and project example |
| --- | --- |
| Repository | Tracked source and its history |
| Working tree | Files currently on disk that you edit |
| Staging area | Selected changes prepared for the next commit |
| Commit | Saved snapshot with a message, parent history, and identifier |
| SHA / commit ID | Identifier for a snapshot; used as our image tag |
| Branch | Movable named pointer to a line of commits |
| HEAD | Current checked-out commit/branch reference |
| Remote | Named repository URL; origin is the fork |
| Fork | Your GitHub copy of another repository |
| Upstream | Tracking concept; also the chosen remote name for the original repo |
| Fetch | Download repository history/refs without merging into working branch |
| Pull | Fetch then integrate into the current branch |
| Fast-forward | Move a branch to a descendant commit without a new merge commit |
| Push | Upload local commits/refs to a remote |
| PR | Pull request: proposed branch merge with discussion/review/checks |
| CI | Continuous integration: automated checks on changes |
| CD | Continuous delivery/deployment: prepare or deploy validated changes |
| Runner | Temporary machine executing GitHub Actions jobs |
| Workflow | YAML definition of events, jobs, permissions, and steps |
| Registry | Image storage/distribution service; GHCR in this project |
| Tag | Image label, here the full publishing commit SHA |
| Digest | Content identifier such as sha256:...; different from tag |
| GitOps | Reconcile approved Git configuration into a running environment |
| Desired state | What Git manifests request |
| Live state | What the cluster currently has |
| Sync | Argo applies desired configuration |
| Synced | Desired and live managed configuration agree |
| Healthy | Argo's health checks consider resources operational |
| Prune | Remove resources no longer declared in Git; disabled here |
| Self-heal | Automatically correct live drift at the same revision; disabled here |

## Docker and Kubernetes

| Term | Plain meaning and project example |
| --- | --- |
| Dockerfile | Recipe describing image build stages and startup command |
| Build context | Files available to docker build; dot means current directory |
| Image | Packaged filesystem/runtime/app used to create containers |
| Container | Running instance of an image with isolated process environment |
| Layer/cache | Reusable image/build result; avoids repeating unchanged work |
| Volume | Storage with a lifetime separate from a container |
| Compose | Describes and runs connected local services |
| Cluster | Kubernetes control plane and nodes |
| Context | Saved cluster/user/namespace connection selection |
| Namespace | Logical grouping of resources; default, argocd, traefik |
| Node | Machine/VM/container environment that hosts Pods |
| Control plane | API, scheduling, state, and controllers managing the cluster |
| kubectl | Command-line Kubernetes client on your computer |
| kubelet | Node agent that arranges assigned Pod/container execution |
| Pod | Kubernetes scheduling unit wrapping one or more containers |
| Deployment | Maintains desired app Pod templates and rollouts |
| ReplicaSet | Maintains a count of matching Pods on behalf of Deployment |
| Label/selector | Tags and matching rules connecting Services/Deployments to Pods |
| Service | Stable network identity selecting ready backend Pods |
| ClusterIP | Internal cluster Service address, not Windows host publishing |
| NodePort | Exposes a node-level port; host reachability depends on networking |
| LoadBalancer | Requests external access through the environment's integration |
| EndpointSlice | Records backend addresses/readiness for a Service |
| Ingress | HTTP hostname/path routing instructions |
| Ingress controller | Software applying routing instructions; Traefik here |
| IngressClass | Identifies the controller responsible for an Ingress |
| ConfigMap | Non-secret configuration values |
| Secret | Sensitive runtime configuration object; base64 is not encryption |
| PV | PersistentVolume: a storage resource |
| PVC | PersistentVolumeClaim: request for persistent storage |
| StorageClass | Defines how storage can be provisioned |
| RWO | ReadWriteOnce: read/write mounting on one node |
| Readiness probe | Decides whether a Pod should receive normal Service traffic |
| Liveness probe | Detects when a container should restart |
| Startup probe | Allows initialization before readiness/liveness begin |
| Request | Resource amount used for scheduling and utilization calculations |
| Limit | Resource cap; CPU throttles, excess memory can terminate |
| HPA | Horizontal Pod Autoscaler: adjusts app Pod count from metrics |
| VPA | Vertical Pod Autoscaler: adjusts resource requests; not installed here |
| Cluster Autoscaler | Adjusts node count; not installed here |
| Helm | Kubernetes package manager |
| Chart | Helm package of templates/default settings |
| Release | Installed Helm chart instance; traefik in namespace traefik |
| Values | Overrides supplied to a Helm chart |
| RollingUpdate | Gradually replace app Pods while maintaining availability |
| Recreate | Stop old Pods before replacements; used for single MySQL here |
| OOMKilled | Container terminated after exhausting allowed memory |

## Persistence and recovery

| Term | Plain meaning |
| --- | --- |
| Connection pool | Reuses a bounded set of database connections |
| Grant | Permission assigned to a SQL account |
| Backup | Separate recovery copy of data |
| Restore | Reconstruct database state from a backup |
| Snapshot time | Recovery only includes changes captured by that backup |
| Rollback | Restore an earlier app/config version; does not itself restore DB data |
| Migration | Deliberate database structure/data transformation |
| HA | High availability; multiple app Pods alone do not provide full-system HA |

## Units seen in commands

- 100m CPU = 0.1 core; 1m = 0.001 core.
- Mi = mebibytes; Gi = gibibytes (binary units).
- HPA 50% = half the configured CPU request, not half the laptop's CPU.
- `--timeout=180s` = stop waiting after 180 seconds; not proof of the cause.
- `-w` watches; Ctrl+C stops watching, not the application.
- `-f FILE` reads a resource file; `-f -` reads standard input.
- PowerShell and Linux shell quoting differ. GitHub runner bash commands with
  backslash continuation are not directly interchangeable with PowerShell.
