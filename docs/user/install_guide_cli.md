# Installation Guide: CLI / Linux Fast Path

This guide provides the technical "Fast Path" for setting up the HeroBM Platform on Linux or Windows using the command line. This is the preferred method for remote servers, CI/CD environments, and power users.

## 1. Installation Sequence

Run these commands in order from the root of the project. Each command provides clear feedback on success or failure.

### Phase 1: Environment & Dependencies
1.  **`make cli-install-prereqs`**: Installs OS-level tools (Podman, Node, Python, Typst). On Linux, this includes a robust fallback to download the Typst binary if the package manager lacks it.
2.  **`make cli-init-env`**: Generates your `.env` file and secure random secrets for all local services.
3.  **`make cli-setup-python`**: Creates the Python virtual environment (`.venv`) and installs the required data pipeline dependencies.
4.  **`make cli-install-npm`**: Installs the JavaScript dependencies for the API and Portals.

### Phase 2: Database Infrastructure
5.  **`make cli-up-db`**: Starts the PostgreSQL and Redis containers.
6.  **`make cli-init-db`**: Initializes the database schemas. **Note**: This target will automatically wait up to 60 seconds for the database container to become healthy before proceeding.
7.  **`make cli-migrate`**: Applies all Drizzle SQL migrations to bring your schema to the latest version.

### Phase 3: Application & Data
8.  **`make cli-bootstrap`**: Executes the unified setup logic (COA loading, Organization config, and Base Seeding). It will **automatically run verification** at the end to confirm the `admin` user exists.

---

## 2. Production-Like Local Testing

To verify the full stack in a production-like environment (Standalone mode):

```bash
make prod-local
```

### Verified Configuration
- **API Port**: 3001 (Production standard)
- **Portal Port**: 4301
- **API URL**: Automatically routed via `API_URL` environment variable.

## 3. Daily Usage

For daily development or testing on a remote server, use **tmux** to keep your processes running after you disconnect:

1.  Run `tmux`.
2.  Run `make prod-local`.
3.  Press `Ctrl+B`, then `D` to detach.
4.  Run `tmux attach` when you return.

## 4. Troubleshooting

### "pg_isready: command not found"
Ensure Podman is running and you have properly executed `make cli-install-prereqs`.

### "Cannot find native binding" (Linux)
If you recently upgraded Node, re-run `make cli-install-npm` to re-compile native binaries for the new environment.

### Re-running Setup
All `cli-` targets are designed to be idempotent. You can safely re-run them if a step fails or if you need to refresh your environment.
