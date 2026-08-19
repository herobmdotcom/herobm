---
id: crm
title: "CRM: Actors, Projects & Contacts"
description: "Manage business relationships, internal projects, contacts, activity logs, and geographic account maps."
category: "CRM"
order: 22
resource: "crm"
action: "read"
routes:
  - "/crm/actors"
  - "/crm/projects"
  - "/crm/contacts"
  - "/crm/map"
tags: ["crm", "actors", "companies", "projects", "contacts", "map"]
fields:
  actor_name:
    title: "Actor / Company Name"
    summary: "Unified business entity profile (Customer, Supplier, Prospect, or Partner)."
  project_title:
    title: "Project Title"
    summary: "Internal initiative or project tracker."
related:
  - "customers"
  - "suppliers"
  - "sales-quotes"
  - "sales-orders"
---

# CRM: Actors, Projects & Contacts

The **CRM** module tracks client relationships, project initiatives, communication history, and geographic territory mapping.

---

## Unified Actor Model

### 1. The Unified Actor Concept
Instead of maintaining separate records across departments, an **Actor** represents a business entity. An Actor can be simultaneously a customer, supplier, and prospect without duplicating records or addresses.

### 2. Map View
The **Map** view (`/crm/map`) plots customer and prospect locations geographically, helping sales representatives plan on-site visits and territory routes.

---

## Step-by-Step Workflows

### 1. Creating a CRM Project
1. Go to **CRM** → **Projects** (`/crm/projects`).
2. Click **+ New Project**.
3. Select or create the **Actor (Company)**.
4. Enter the **Project Title**.
5. Log meeting notes, calls, and follow-up tasks in the activity timeline.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Actor** | Company or organisation entity. |
| **Project Title** | Project or initiative name. |
