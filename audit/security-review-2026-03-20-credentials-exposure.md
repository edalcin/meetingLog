# Security Review — Credentials Exposure

**Project**: meetingLog
**Tech Stack**: Node.js 22, Hono, mysql2/promise, Alpine.js, Tailwind CSS, MariaDB, Docker
**Review Date**: 2026-03-20
**Files Reviewed**: All git-tracked files (excluding node_modules)
**Reviewer**: Claude Sonnet 4.6 (automated + manual analysis)

---

## Summary

A targeted audit was performed to identify any hardcoded credentials, internal IP addresses, API tokens, or connection strings committed to the repository. The audit revealed a **critical** exposure: real database credentials were committed in `scripts/migrate-notas-to-quill.js` and were pushed to the remote GitHub repository. Additionally, the same credentials appeared in multiple spec/documentation files throughout the repository history.

All affected files have been remediated in this commit. However, the credentials remain in git history across multiple commits and **must be treated as permanently compromised**.

---

## Critical Findings

### CRIT-001 — Real database password hardcoded in committed script

**Severity**: CRITICAL
**CWE**: CWE-798 (Use of Hard-coded Credentials)
**File**: `scripts/migrate-notas-to-quill.js` (lines 9–13)
**Commit introduced**: `da1924c` (feat(notas): replace textarea with Quill rich text editor)

**Exposed data**:
- Host: `DB_HOST` (internal network address)
- Port: `3333`
- Database: `reunioes`
- User: `root` (superuser — maximum privilege)
- Password: `***REMOVED***`

**Impact**: Anyone with read access to the GitHub repository (public or anyone with org access) could connect directly to the production MariaDB instance with root credentials. Full read/write/drop access to all databases on the server.

**Fix applied**: Replaced hardcoded values with `process.env` lookups and safe defaults (`localhost`, `3306`, empty password):
```js
const DB = {
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT     ?? 3306),
  database: process.env.DB_NAME     ?? 'reunioes',
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
}
```

---

## High Priority Issues

### HIGH-001 — Same credentials repeated in spec/documentation files

**Severity**: HIGH
**CWE**: CWE-200 (Exposure of Sensitive Information), CWE-798
**Files affected** (all git-tracked):

| File | Type of exposure |
|------|-----------------|
| `specs/005-add-notas-editor/plan.md:106` | Password `***REMOVED***` in code block |
| `specs/005-add-notas-editor/tasks.md:33` | IP `DB_HOST:3333` and credentials reference |
| `specs/003-add-projetos/data-model.md:93` | Password `***REMOVED***` |
| `specs/003-add-projetos/quickstart.md:15` | IP `DB_HOST:3333` |
| `specs/003-add-projetos/tasks.md:44` | IP + password `***REMOVED***` |
| `specs/004-.../plan.md:18` | IP `DB_HOST:3333` |
| `specs/004-.../quickstart.md:73-74` | Password + IP |
| `specs/004-.../tasks.md:25` | IP `DB_HOST:3333` |
| `specs/002-add-participantes/plan.md:84` | Password `***REMOVED***` |
| `specs/002-add-participantes/tasks.md:70` | Password `***REMOVED***` |
| `.specify/memory/constitution.md:15,148` | IP `DB_HOST:3333` |

**Fix applied**: All occurrences replaced with placeholder references to environment variables.

---

## Medium/Low Priority

### MED-001 — `docs/source/scripts/` is gitignored but contains credentials on disk

**Severity**: MEDIUM (local only — not pushed to remote)
**Files** (local disk, NOT tracked by git):
- `docs/source/scripts/import_instituicoes.js` — hardcoded host + password
- `docs/source/scripts/migrate-participantes.js` — hardcoded password
- `docs/source/scripts/migrate-projetos.js` — hardcoded password
- `docs/source/scripts/migrate_notas.js` — password in fallback default
- `docs/source/scripts/recover-reuniao-participantes.js` — hardcoded host + password

These files are correctly excluded from the repository via `.gitignore`. No remediation required for the remote repository. However, these scripts should be updated locally to use environment variables rather than fallback literals, to eliminate risk of accidental future commit.

### MED-002 — `.claude/settings.local.json` contains credentials in allowed command list

**Severity**: MEDIUM (local only — gitignored via `.claude/settings*.json`)
**Status**: Not tracked by git. File is correctly excluded.

---

## MANDATORY ACTION: Git History Contains Exposed Credentials

**This is the most critical outstanding action item.**

The password `***REMOVED***` and IP `DB_HOST` appear in the following commits in git history:

```
da1924c  feat(notas): replace textarea with Quill rich text editor
ac9adb5  feat(notas): add notas column, migration, and text editor UI
280fb92  feat(pautas): add pauta table with CSV migration, API support, and form card
b29b8b4  feat: add projetos table, menu navigation, and meeting-project association
58dc376  feat: add participants table with multi-select UI and data migration
18b3125  docs: add project constitution with patterns and lessons learned
```

These commits are already on the remote repository (GitHub). **Removing the credentials from working files does not remove them from git history.** Anyone who clones the repository can access the historical versions.

### Required Actions (in order of priority)

**Step 1 — Rotate the credentials immediately (HIGHEST PRIORITY)**

Before doing anything with git history, assume the credentials are compromised:

1. Connect to the MariaDB server and change the root password:
   ```sql
   ALTER USER 'root'@'%' IDENTIFIED BY '<new-strong-password>';
   FLUSH PRIVILEGES;
   ```
2. If the application uses root credentials (it should not), create a dedicated app user with minimum required privileges and update `.env`.
3. Consider whether `DB_HOST` needs firewall rules reviewed — if the MariaDB port (`3333`) is accessible from outside the LAN, restrict it immediately.

**Step 2 — Rewrite git history to remove credentials**

Use BFG Repo Cleaner (recommended, simpler than `git filter-branch`):

```bash
# 1. Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. Create a file listing strings to replace
echo '***REMOVED***' > secrets.txt
echo 'DB_HOST'   >> secrets.txt

# 3. Clone a fresh mirror of the repository
git clone --mirror https://github.com/<owner>/meetingLog.git meetingLog-mirror.git

# 4. Run BFG to replace secrets in all history
java -jar bfg-1.14.0.jar --replace-text secrets.txt meetingLog-mirror.git

# 5. Clean up the mirror
cd meetingLog-mirror.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Force-push all branches and tags (DESTRUCTIVE — coordinate with all collaborators)
git push --force
```

Alternatively, use `git filter-repo` (newer, built-in to recent git):
```bash
pip install git-filter-repo
git filter-repo --replace-text secrets.txt
git push origin --force --all
```

**Step 3 — After force-push**

- All local clones must be re-cloned (not rebased) from the new history
- If the repository is public, notify GitHub support to clear their caches
- Audit any CI/CD logs, issue comments, or pull request diffs that may have echoed the credentials

---

## Recommendations

1. **Adopt a secrets scanning pre-commit hook** — install `detect-secrets` or `gitleaks` to prevent future credential commits:
   ```bash
   pip install detect-secrets
   detect-secrets scan > .secrets.baseline
   # add pre-commit hook
   ```

2. **Never use root for application or migration scripts** — create a dedicated `migrations` user with only the required DDL/DML privileges on the `reunioes` database.

3. **Move migration scripts out of docs into a proper tool** — consider using a migrations tool (e.g., `db-migrate`, `Flyway`) that reads credentials exclusively from environment variables.

4. **The `.gitignore` rule for `docs/source/scripts/`** is correct and must be kept. Verify it is also in `.dockerignore`.

---

## Verification Checklist

- [x] `git grep "dEL\*e34B5yKx2x"` returns no results in current HEAD
- [x] `git grep "DB_HOST"` returns no results in current HEAD
- [ ] Root database password has been rotated
- [ ] Git history has been rewritten with BFG or git filter-repo
- [ ] Remote force-push completed and confirmed
- [ ] All local clones re-cloned from new history
- [ ] `detect-secrets` or `gitleaks` pre-commit hook installed

---

## References

- [OWASP: Hardcoded Passwords](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git filter-repo](https://github.com/newren/git-filter-repo)
- [GitHub: Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
