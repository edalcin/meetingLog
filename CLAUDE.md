# meetingLog Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-08

## Project Overview

Meeting log web application. Single Node.js (Hono) container serving REST API + Alpine.js frontend, backed by an external MariaDB instance. Deployed on UNRAID via Docker.

## Active Technologies
- Node.js 22, ES modules + Hono (web framework), mysql2/promise (MariaDB driver), Alpine.js CDN, Tailwind CSS CDN (002-add-participantes)
- MariaDB — tabelas `participante`, `reuniao_participante`; remoção de `reuniao.participantes` TEXT (002-add-participantes)
- MariaDB — tabelas `projeto`, `reuniao_projeto`; remoção de `reuniao.projeto` VARCHAR (003-add-projetos)
- MariaDB — tabela `pauta` (1:N com `reuniao`); migration `008_add_pauta.sql` (004-add-pauta)
- Node.js 22, ES modules + Hono (web framework), mysql2/promise (DB), Alpine.js CDN, Tailwind CSS CDN (005-add-notas-editor)
- MariaDB — `reunioes` database, `reuniao` table — adding column `notas TEXT NULL` (005-add-notas-editor)
- MariaDB — tabela `link` (1:N com `reuniao`); migration `010_add_link.sql`; script CSV `memoriaReunioes-DocsRelacionados.csv` (006-add-links-table)
- Node.js 22 (ES modules) + Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN (008-multi-institution-projects)
- MariaDB — `reunioes` database; junction table `projeto_instituicao` já existe (008-multi-institution-projects)
- Node.js 22, ES modules + Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN (009-maintenance-project-replace)
- MariaDB — tabelas existentes `projeto`, `reuniao_projeto`, `reuniao`, `reuniao_participante`, `participante` (009-maintenance-project-replace)
- Node.js 22, ES modules + Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN, Quill CDN (010-project-notes-links)
- MariaDB — tabela `projeto` (ALTER: +notas), nova tabela `projeto_link` (010-project-notes-links)
- Node.js 22, ES modules + Hono (web framework), mysql2/promise, Alpine.js CDN, Tailwind CSS CDN, Quill CDN (011-enhance-participantes)
- MariaDB — database `reunioes`, tabela `participante` (ALTER) (011-enhance-participantes)
- Node.js 22, ES modules (`import`/`export`) + Hono 4.12.8, mysql2/promise, Alpine.js CDN, Tailwind CDN, Quill CDN (012-fix-security-high)
- MariaDB — sem alterações de schema (012-fix-security-high)

- Node.js 22 + Hono (web framework) — main feature
- mysql2 (MariaDB driver)
- Alpine.js CDN + Tailwind CSS CDN (frontend — no build step)
- Docker (node:22-alpine, multi-stage build)

## Project Structure

```text
src/           # Node.js backend (Hono server, routes, db)
migrations/    # SQL migration files
scripts/       # Utility scripts (CSV importer)
public/        # Static frontend (HTML, Alpine.js, PWA assets)
docs/          # Documentation (UNRAID install guide, source data)
.github/workflows/  # CI/CD (GHCR publish on push to main)
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload
npm run migrate      # Run DB migrations
npm test             # Run unit tests
docker build .       # Build Docker image
```

## Code Style

- Node.js 22: use ES modules (`import`/`export`), async/await throughout
- No TypeScript (keep it simple, single-user tool)
- Hono: use built-in validators for request body validation
- SQL: parameterised queries only (no string interpolation)

## Environment Variables

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_PIN`, `APP_PORT` (default 3000)

## Recent Changes
- 012-fix-security-high: Added Node.js 22, ES modules (`import`/`export`) + Hono 4.12.8, mysql2/promise, Alpine.js CDN, Tailwind CDN, Quill CDN
- 011-enhance-participantes: Added Node.js 22, ES modules + Hono (web framework), mysql2/promise, Alpine.js CDN, Tailwind CSS CDN, Quill CDN
- 010-project-notes-links: Added Node.js 22, ES modules + Hono (web framework), mysql2/promise (MariaDB), Alpine.js CDN, Tailwind CSS CDN, Quill CDN


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
