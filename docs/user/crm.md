---
id: crm
title: "CRM: Actors, Projects & Contacts"
description: "Manage business relationships, contact roles, internal projects, activity logs, and geographic account maps."
category: "CRM"
order: 22
resource: "crm"
action: "read"
routes:
  - "/crm/actors"
  - "/crm/actors/new"
  - "/crm/actors/:id"
  - "/crm/contacts"
  - "/crm/contacts/new"
  - "/crm/contacts/:id"
  - "/crm/projects"
  - "/crm/projects/new"
  - "/crm/projects/:id"
  - "/crm/map"
tags: ["crm", "actors", "companies", "projects", "contacts", "map", "roles"]
fields:
  actor_name:
    title: "Actor / Company Name"
    summary: "Unified business entity profile (Customer, Supplier, Prospect, or Partner)."
  contact_role:
    title: "Contact Role"
    summary: "Functional responsibility: Billing, Delivery, Purchasing, Sales, or General."
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

The **CRM** module tracks client relationships, organizational contacts and functional roles, project initiatives, communication history, and geographic territory mapping.

---

## Unified Actor & Contact Roles Architecture

### 1. The Unified Actor Concept
Instead of maintaining separate, disconnected company records across departments, an **Actor** represents a unified business entity. An Actor can simultaneously serve as a customer, supplier, and partner without duplicating base profile data or address books.

### 2. Contact Roles & Slide-Over Drawer
Contacts linked to an Actor are assigned functional **Contact Roles**:
- **Billing / Accounts**: Automatically selected when emailing Sales Invoices or Statements.
- **Delivery / Logistics**: Automatically selected when dispatching Shipping Dockets and Tracking Numbers.
- **Purchasing / Procurement**: Automatically selected when transmitting Purchase Orders.
- **Sales / Commercial**: Assigned to quotes and commercial correspondence.
- **General / Primary**: Default contact point for general inquiries.

The **Quick Contact Slide-Over** (`ContactSlideOver`) allows operators to view, create, and update contacts seamlessly from Customer, Supplier, Order, or Shipment screens without leaving their active workflow.

### 3. Interactive Territory Map
The **Map** view (`/crm/map`) plots customer and prospect physical locations geographically on an interactive map, helping sales representatives plan on-site visits and optimize territory travel.

---

## Step-by-Step Workflows

### 1. Adding a Contact with Specific Roles
1. Go to **CRM** → **Contacts** (`/crm/contacts`) or open the **Contacts** tab on any Customer/Supplier record.
2. Click **New Contact** (`/crm/contacts/new`).
3. Enter the contact's **First Name**, **Last Name**, **Email**, and **Phone**.
4. Select the primary **Role** (e.g. `Billing / Accounts`).
5. Toggle **Primary Contact** if this person should receive standard automated notifications.
6. Click **Save Contact**.

### 2. Creating a CRM Project
1. Go to **CRM** → **Projects** (`/crm/projects`).
2. Click **New Project** (`/crm/projects/new`).
3. Select or create the **Actor (Company)**.
4. Enter the **Project Title** and description.
5. Log meeting notes, calls, and follow-up tasks in the activity timeline.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Actor** | Company or organisation entity. |
| **Contact Name** | First and last name of the representative. |
| **Contact Role** | Responsibility: `Billing`, `Delivery`, `Purchasing`, `Sales`, `General`. |
| **Email & Phone** | Direct electronic communication endpoints. |
| **Project Title** | Project or initiative name. |
| **Primary Flag** | Designates the default contact for document emailing. |
