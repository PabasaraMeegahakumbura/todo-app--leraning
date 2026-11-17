# Clear Day

A calm task workspace built as a practical DevOps learning project. Add tasks,
mark them complete, search your list, and switch between all, active, and
completed tasks. The interface works on phones and desktops, uses system fonts,
and needs no external font service or UI library at runtime.

This is a shared task list: there are no accounts or private per-user lists.
Anyone who can access the app's API can modify its tasks. Keep the learning
installation on a trusted network.

## Run the development stack

With Docker Desktop running, use the repository root:

```powershell
docker compose up --watch
```

Open http://localhost. Compose starts Traefik, Vite, Express, MySQL, and
phpMyAdmin. The database browser is available at http://db.localhost.
The sample Compose credentials are for local development only.

```powershell
docker compose down
```

This stops the stack while retaining its database volume. Adding `-v` removes
volumes and their data.

## Build and test

```powershell
docker build --target test --progress=plain .
docker build -t clear-day:local .
```

The test target runs backend Jest tests. The final image builds React into
static files and bundles them with Express. Run it with its own SQLite volume:

```powershell
docker run -d --name clear-day -p 8084:3000 -v clear-day-data:/etc/todos clear-day:local
```

Open http://localhost:8084. Setting `MYSQL_HOST` switches persistence to MySQL;
otherwise the backend uses SQLite. Database data is separate from the image.

## Project guide

- [Architecture](docs/architecture.md): frontend, API, databases, and deployment.
- `client/src/App.jsx`: task workspace and API interactions.
- `client/src/index.scss`: responsive styles; no Bootstrap stylesheet import.
- `backend/src`: Express routes and persistence adapters.
- `k8s`: Kubernetes app, database, storage, health probes, and autoscaling.
- `infrastructure/argocd`: Argo CD infrastructure configuration, when present.
- `.github/workflows/ci.yml`: tests, manifest validation, image build/publishing.

## Kubernetes and GitOps

Use only your intended cluster context. For the learning setup, explicitly use
`--context docker-desktop`. Review Argo CD's diff before manually syncing Git's
`main/k8s` configuration. Keep pruning disabled for the initial lessons and
exclude the legacy `pvc.yaml` SQLite claim. Argo CD's dashboard configuration
belongs outside the application's `k8s` source directory.

Publishing a new image does not update Kubernetes automatically: update the
Deployment's image tag in a reviewed commit, merge, then sync Argo CD. A UI-only
change still needs a new final image because the frontend assets are baked in.
Do not recreate databases or PVCs just to deploy a new interface.

Root and application database passwords are supplied separately as Kubernetes
Secrets, not committed manifests. The app expects `todo-app-db-secret` with key
`password`; MySQL expects `todo-mysql-secret` with key `mysql-root-password`.
Database users must exist with appropriate permissions. Back up MySQL separately;
Git and Argo CD do not store database data or Secret values.

## Credits and license

Adapted from Docker's `docker/getting-started-todo-app`. The Clear Day interface
and learning documentation replace the sample presentation. The original Apache
2.0 license and applicable attribution are retained in `LICENSE`.
