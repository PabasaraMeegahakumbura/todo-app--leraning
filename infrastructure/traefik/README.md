# Local Traefik installation

Tested chart: 42.4.1  
Traefik version: v3.7.19  
Cluster context: docker-desktop  
Namespace: traefik

## Install or recover

```powershell
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik --version 42.4.1 --namespace traefik --create-namespace --kube-context docker-desktop --wait --timeout 5m
```

## Verify

```powershell
kubectl --context docker-desktop -n traefik get pods,service
kubectl --context docker-desktop get ingressclass
```

The app's Ingress is managed by Argo CD from `k8s/ingress.yaml`.

## Local HTTPS

URL: https://clearday.localhost

Create a locally trusted certificate with mkcert and store the certificate
and private key in the `default/clearday-tls` Kubernetes TLS Secret.

Certificate files and private keys stay outside Git. The Secret must be
recreated if the cluster is lost. Other computers do not automatically
trust this computer's development certificate authority.