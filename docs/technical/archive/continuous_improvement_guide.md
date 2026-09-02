---
id: tech-continuous-improvement
title: "Continuous Improvement & Immune System"
description: "Immune System protocol, advisory lifecycle, AST structural immunization, and regression defense standards."
category: "Architecture & Engineering"
order: 11
resource: "system"
action: "read"
tags: ["continuous-improvement", "advisories", "immune-system", "ast", "invariants", "constitution"]
---

# Continuous Improvement Protocol

As mandated by `CONSTITUTION.MD`, the Composable ERP operates under a strict Continuous Improvement (CI) protocol. This protocol utilizes an "Immune System" approach: bugs, architectural drift, and security flaws are treated as system infections. 

When an issue is found, a tactical fix is insufficient; the system must be *immunized* against that class of problem returning.

---

## 1. The Inspector Persona

The project utilizes an AI-driven persona known as **The Inspector**. The Inspector acts as the Municipal Building Inspector for the HeroBM platform. 
*   It cross-references every file against the Constitution.
*   It looks for credential exposure, network misconfigurations, authorization bypasses, and unauthorized technologies.
*   When the Inspector finds a violation, it files an **Advisory** (`ADV-xxx.md`).

## 2. The Advisory Workflow

All known architectural, security, or structural violations are stored in `docs/continuous_improvement/advisories/open/`. 

When an advisory is created, it follows a rigorous 6-step resolution workflow:

### Step 1: Capture
The developer (or AI Agent) reads the advisory file to understand the context, the exact location of the error, and the constitutional rule it violates.

### Step 2: Tactical Fix (Correct)
The required codebase files are modified to fix the immediate issue. If the fix involves changing API contracts or payloads, the E2E test suite in `apps/api` must be executed to ensure no frontend breakages occur.

### Step 3: Strategic Setup Update & Immunize (Root Cause Update)
**This is the core of the Immune System.** The class of the problem is identified. To prevent recurrence, the developer must:
*   Write a new automated structural test in `infra/tests/` that explicitly catches this class of problem. 
*   Update relevant documentation, rules, or scaffolding. 
*   *The resolution is not complete until a test asserts it.*

### Step 4: Draft Remediation Record
A formal remediation document is generated from a template and saved to `docs/continuous_improvement/remediations/REM-YYYY-MM-DD-advXXXX.md`. This record documents both the tactical fix and the new structural test (the strategic update).

### Step 5: Systemic Audit
The developer must scan the **entire codebase** using `grep` or similar tooling to ensure no other instances of the same anti-pattern exist. If found, they are fixed in the same PR. If not, the remediation record explicitly states "Systemic audit complete — no further instances found."

### Step 6: Close the Advisory
The advisory file is moved from `advisories/open/` to `advisories/resolved/`, and its YAML frontmatter status is updated to `resolved`.

---

## 3. Creating a New Advisory

If you discover a systemic issue or architectural flaw that cannot be fixed immediately, you must create a formal advisory file.

**Path:** `docs/continuous_improvement/advisories/open/ADV-xxx.md` (increment the number).

**Required YAML Frontmatter:**
```yaml
id: ADV-xxx
status: open
vector: [e.g., Security, Architecture, UX, Performance]
rule_violation: [Reference the exact section of CONSTITUTION.MD or a technical guide]
raised_date: YYYY-MM-DD
severity: [CRITICAL | HIGH | MEDIUM | LOW]
```

## 4. Remediation vs Backlog

*   **Backlog:** Used for new feature requests, UI polish, or minor bugs that do not violate architectural boundaries (e.g., "The button color is slightly off"). Handled via standard tickets or the `/backlog` agent workflow.
*   **Advisory:** Used exclusively for issues that violate the Constitution, leak secrets, compromise security, or introduce architectural anti-patterns (e.g., "The UI is making a raw `fetch()` call instead of using the typed `apiFetch` wrapper").
