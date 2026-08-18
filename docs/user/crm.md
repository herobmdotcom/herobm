---
id: crm
title: "CRM: Actors, Contacts & Projects"
description: "Managing business relationships, stakeholders, project associations, and geographic mapping."
category: "CRM"
order: 1
resource: "actor"
action: "read"
routes:
  - "/crm/actors"
  - "/crm/actors/:id"
  - "/crm/projects"
  - "/crm/projects/:id"
  - "/crm/contacts"
  - "/crm/contacts/:id"
  - "/crm/map"
tags: ["crm", "actors", "contacts", "projects", "relationships", "map"]
fields:
  actor_name:
    title: "Actor Name"
    summary: "Company, organization, or stakeholder name representing an external commercial entity."
  project_id:
    title: "Project"
    summary: "Commercial job or site project linked to actors, sales quotes, and orders."
  contact_details:
    title: "Contact Information"
    summary: "Direct telephone numbers, email addresses, and key decision-maker roles."
related:
  - "sales-orders"
  - "purchase-orders"
---

# Customer Relationship Management (CRM)

The **CRM Module** provides a unified view of relationships with clients, contractors, vendors, and partners.

---

## Structure & Concepts

1. **Actors**: Commercial entities, suppliers, customers, or prospective partners.
2. **Projects**: Specific jobs or operational undertakings tied to one or more actors.
3. **Contacts**: Individual people associated with actors and projects.
4. **CRM Map**: Visual map representation of actor locations, job sites, and warehouse proximity.
