# 🚀 Personality Simulation Engine

[![GitHub Action: Backend](https://img.shields.io/badge/Workflow-Backend-blue?logo=github-actions&logoColor=white)](.github/workflows/backend.yaml)
[![GitHub Action: Frontend](https://img.shields.io/badge/Workflow-Frontend-orange?logo=github-actions&logoColor=white)](.github/workflows/frontend.yaml)
[![App: Node.js](https://img.shields.io/badge/App-Node.js-339933?logo=node.js&logoColor=white)](application/backend)

This repository contains the source code and CI/CD workflows for the **Personality Simulation Engine**. It is decoupled from the infrastructure layer to allow for independent scaling and development.

## 🏗 Repository Structure

-   **[`backend/`](./backend)**: A Node.js Express server that handles personality scoring, trait selection, and narrative generation via a REST API.
-   **[`frontend/`](./frontend)**: A modern, dark-mode dashboard (React/Next.js) that captures user data and visualizes it.
-   **[`.github/workflows/`](./.github/workflows)**: GitHub Actions that build Docker images on every push to `main` and update the deployment manifests in the [Infrastructure Repository](https://github.com/ameerahaider/personality-simulation-engine-infra).



## 🚀 Development Quickstart

### 1. Backend (Node.js)
1.  `cd backend`
2.  `npm install`
3.  `npm start`
    - *API runs at `http://localhost:5678`*

### 2. Frontend (Static/Docker)
1.  `cd frontend`
2.  `docker build -t frontend-dashboard .`
3.  `docker run -p 8080:80 frontend-dashboard`
    - *Dashboard runs at `http://localhost:8080`*

## 📡 API Endpoints
-   `GET /api/questions`: Get psychological prompts.
-   `POST /api/interpret`: Submit results and get scores/narratives.

## 🔄 CI/CD Workflow
1.  **Code Change**: Push to the `backend/` or `frontend/` folders.
2.  **Docker Build**: GitHub Actions build a new image tagged with the `run_id`.
3.  **Registry Push**: Images are pushed to the **DigitalOcean Container Registry**.
4.  **Manifest Update**: The workflow clones the `task-manager-infra` repo and uses `sed` to update the image tag in the Kubernetes manifests.
5.  **ArgoCD Sync**: ArgoCD detects the change in the infra repo and automatically redeploys the app to the cluster.

---

> [!IMPORTANT]
> **Prerequisites**: You must have a `PAT_TOKEN` (Personal Access Token) and `DIGITALOCEAN_TOKEN` configured as GitHub Secrets for the CI/CD pipeline to work.
