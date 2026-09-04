---
id: dashboard
title: "Operations Dashboard"
description: "Monitor live business metrics and operational shortcuts using configurable widgets."
category: "Dashboard"
order: 1
resource: "dashboard"
action: "read"
routes:
  - "/"
tags: ["dashboard", "home", "metrics", "kpi", "shortcuts", "activity", "tasks", "crm"]
fields:
  pinned_report_widgets:
    title: "Pinned Report Widgets"
    summary: "Dynamic, configurable KPI cards displaying relevant metrics based on user preference."
  my_tasks:
    title: "My Tasks & Follow-ups"
    summary: "Action item widget displaying assigned CRM tasks, priority flags, and due dates."
  recent_activity:
    title: "Activity Stream"
    summary: "Real-time timeline of recent orders, shipments, receipts, and invoices."
related:
  - "sales-orders"
  - "purchase-orders"
  - "inventory"
  - "general-ledger"
  - "crm"
---

# Operations Dashboard

The **Operations Dashboard** is the daily operational cockpit. It provides real-time visibility across sales performance, warehouse deliveries, stock shortages, pending CRM tasks, and recent team activity through configurable widgets.

---

## Key Dashboard Widgets

```mermaid
flowchart TD
    D[Operations Dashboard /] --> K1[Configurable KPI Widgets]
    D --> K2[Follow-up Tasks Widget]
    D --> K4[Live Activity Stream]
    D --> K3[Quick Actions Shortcuts]
```

### 1. KPI Summary Cards
The dashboard uses a dynamic, configurable `PinnedReportWidget` system. Users can pin different metrics to their dashboard tailored to their specific roles, such as sales volume, pending deliveries, or stock demand queues.

### 2. Follow-up Tasks Widget
The **My Tasks** widget keeps daily action items and scheduled client touchpoints front and center:
- **Filter Switch**: Toggle between **My Tasks** (filtered specifically for the current logged-in user) and **All Open Tasks** (team-wide backlog).
- **Priorities & Due Dates**: Displays urgency badges (`Urgent`, `High`, `Medium`, `Low`) and visually flags tasks that are overdue or due today.
- **Inline Completion**: Check off completed tasks with a single click to instantly close them.
- **Quick Task Creation**: Click **New Task** to schedule client calls, emails, or operational follow-ups without leaving the dashboard.

### 3. Live Activity Stream
Displays real-time events across all departments:
- Newly confirmed sales orders.
- Dispatched customer shipments.
- Completed supplier receipts and stock putaways.
- Posted sales and supplier invoices.

### 4. Quick Actions
Direct shortcuts to common daily workflows:
- **New Sales Order**: Create a draft quotation or sales order.
- **New Purchase Order**: Raise a supplier purchase order.

---

## Daily Operator Workflow

1. Review your **Pinned Report Widgets** for relevant queues or required actions.
2. Check your **Follow-up Tasks** to complete or schedule calls, emails, and follow-ups.
3. Use the **Activity Stream** to monitor order status changes and invoice postings.
4. Utilize **Quick Actions** to quickly generate new sales or purchase orders.

