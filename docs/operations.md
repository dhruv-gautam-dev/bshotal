# Production Operations & Maintenance Manual
**B.S. Hotel & Restaurant & Delicee Pure-Veg Restaurant**

This guide provides step-by-step procedures for managing PostgreSQL on Supabase, handling backups, disaster recovery, running schema migrations, monitoring database health, and key rotation.

---

## 1. Supabase Backups & Disaster Recovery

### Automated Backups
| Plan | Backup Type | Retention | Recovery Speed | Recommendation |
|---|---|---|---|---|
| **Free Tier** | Nightly snapshot | 7 days | Restore from snapshot | Development / Staging only |
| **Pro Tier ($25/mo)** | Point-in-Time Recovery (PITR) + Daily snapshots | Up to 28 days | Granular to the second | **Required for Production** |

> [!WARNING]
> **Free Tier Auto-Pause**: Supabase Free Tier projects pause automatically after 7 days of inactivity. Before launching for real guests and hotel operations, upgrade the project to **Supabase Pro** to prevent downtime.

---

## 2. Manual Backup & Restore Procedures

Always take a manual backup before running major migrations or bulk menu updates.

### A. Windows PowerShell Backup Script (`backup.ps1`)

Save as `scripts/backup.ps1`:
```powershell
# B.S. Hotel & Restaurant - Database Backup Script (PowerShell)
param(
    [string]$DbUrl = $env:DIRECT_DATABASE_URL
)

if (-not $DbUrl) {
    Write-Error "DIRECT_DATABASE_URL environment variable is not set."
    exit 1
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupDir = "backups"
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
$OutputFile = "$BackupDir/bshotel_backup_$Timestamp.sql.gz"

Write-Host "[INFO] Starting PostgreSQL backup to $OutputFile..." -ForegroundColor Cyan

# Requires pg_dump installed (from PostgreSQL tools or pgAdmin)
& pg_dump "$DbUrl" --clean --if-exists --no-owner --no-privileges | gzip > "$OutputFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Backup completed successfully: $OutputFile" -ForegroundColor Green
} else {
    Write-Error "[ERROR] Backup failed. Check credentials and network connectivity."
}
```

### B. Linux / macOS Backup Script (`backup.sh`)

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
mkdir -p "$BACKUP_DIR"
OUTPUT_FILE="$BACKUP_DIR/bshotel_backup_$TIMESTAMP.sql.gz"

echo "[INFO] Running pg_dump for B.S. Hotel & Restaurant..."
pg_dump "$DIRECT_DATABASE_URL" --clean --if-exists --no-owner --no-privileges | gzip > "$OUTPUT_FILE"
echo "[SUCCESS] Backup saved to $OUTPUT_FILE"
```

### C. Database Restore Procedure

To restore from a gzipped SQL dump:
```powershell
# PowerShell (Windows)
gunzip -c backups/bshotel_backup_2026-11-05.sql.gz | psql "$DIRECT_DATABASE_URL"
```

```bash
# Linux / macOS
gunzip -c backups/bshotel_backup_2026-11-05.sql.gz | psql "$DIRECT_DATABASE_URL"
```

---

## 3. Running Production Migrations Safely

### Rules for Zero-Downtime Migrations:
1. **Never use the transaction pooler (port 6543) for migrations**: Always point `DIRECT_DATABASE_URL` to port `5432` (Direct connection or session pooler).
2. **Never run auto-migrations on app boot in production**: Migrations must be run as an explicit deployment step.
3. **Always test backward compatibility**: Additive changes (adding nullable columns or defaults) should be deployed before application code changes.

### Execution Commands:

```powershell
# 1. Check current database revision
alembic current

# 2. Check pending migrations
alembic heads

# 3. Apply all pending migrations to Supabase
alembic upgrade head

# 4. Rollback last migration (if needed)
alembic downgrade -1
```

---

## 4. Key & Credential Rotation Protocol

### Rotating Database Password
1. Navigate to **Supabase Dashboard** ➔ **Project Settings** ➔ **Database**.
2. Scroll to **Database password** and click **Reset password**.
3. Generate a strong, random 32+ character password.
4. Immediately update `DATABASE_URL` and `DIRECT_DATABASE_URL` in:
   - Your hosting provider environment variables (Render / Railway / Fly.io).
   - Local `backend/.env`.
5. Trigger a rolling restart of the backend service.

### Rotating JWT `SECRET_KEY`
1. Generate a new 64-character secret:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Update `SECRET_KEY` in your production environment settings.
3. Restart the backend service.
*(Note: Active staff sessions will be asked to sign in again after rotation).*

### Rotating Supabase `service_role` Key
1. Go to **Supabase Dashboard** ➔ **Project Settings** ➔ **API**.
2. Under **Project API keys**, click **Rotate key** for `service_role`.
3. Update `SUPABASE_SERVICE_ROLE_KEY` in backend environment variables.

---

## 5. Monitoring & Performance Optimization

### Key Supabase Metrics to Watch:
1. **Active Connections**: Under **Database** ➔ **Connection Pooler**. Keep client connections within your pooler allocation (Nano compute handles up to 200 client connections).
2. **Cache Hit Rate**: Aim for > 99%. A drop below 90% indicates queries are reading from disk rather than RAM.
3. **Slow Queries (`pg_stat_statements`)**:
   Run this query in Supabase SQL Editor to detect queries taking longer than 100ms:
   ```sql
   SELECT query, calls, total_exec_time / calls AS avg_ms, rows
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC
   LIMIT 10;
   ```

---

## 6. Incident Triage Checklist

| Symptom | Probable Cause | Action |
|---|---|---|
| **`/ready` returns 503** | Database unreachable or credentials invalid | 1. Check Supabase project status (is project paused?)<br>2. Verify DB password in host env vars.<br>3. Check pooler status in Supabase. |
| **"Remaining connection slots are reserved"** | Pool exhaustion | 1. Ensure app is using port 6543 (transaction pooler).<br>2. Verify `DB_POOL_SIZE` is set to 10 in backend config.<br>3. Terminate idle connections in Supabase SQL editor: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';` |
| **"Prepared statement does not exist"** | PgBouncer cache mismatch | Verify `STATEMENT_CACHE_SIZE=0` is set in backend `.env`. |
| **Image upload fails** | Storage bucket missing or permissions issue | 1. Confirm buckets `room-photos`, `menu-photos`, `gallery` exist.<br>2. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set correctly. |

