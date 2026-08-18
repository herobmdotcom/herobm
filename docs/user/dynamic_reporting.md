---
id: dynamic-reporting
title: "Dynamic Reporting & Typst Templates"
description: "Browser-based visual template editor, Typst markup, live test records, and automated PDF document generation."
category: "Reporting"
order: 1
resource: "report"
action: "read"
routes:
  - "/reporting"
  - "/reporting/config"
  - "/reporting/config/:id"
  - "/admin/settings/pdf-templates"
  - "/admin/settings/pdf-hooks"
tags: ["reporting", "pdf", "templates", "typst", "invoices", "picking-slips", "admin"]
fields:
  system_hook:
    title: "System Hook"
    summary: "The operational trigger point (e.g., sales-invoice, purchase-order, picking-slip) calling this template."
  target_record:
    title: "Target Record"
    summary: "Sample entity ID used to populate test data into the live Typst PDF preview."
  typst_source:
    title: "Typst Source"
    summary: "Typesetting markup defining page geometry, headers, tables, typography, and JSON data bindings."
related:
  - "sales-orders"
  - "general-ledger"
---

# Dynamic Reporting Guide

Welcome to the **Dynamic Reporting** system! HeroBM now features a fully database-driven reporting engine that allows you to manage, edit, and test all printable documents (like Invoices, Quotes, and Picking Slips) directly from your browser. 
 

You no longer need an engineer to modify the visual aesthetics, layout, or text of your operational documents.

## How It Works

HeroBM's dynamic reporting allows administrators to map **Context Data** (like a specific "Sales Invoice") into a **Typst Template** in real-time. Whenever a user prints a PDF, the system grabs the latest template string from the database, retrieves the latest structured data for that specific record, and complies them into a pixel-perfect PDF document.

### The Reporting Admin UI

To access the template management console, go to **Admin > Reporting** on the left-side navigation panel. 

Here you will see a master list of all templates currently running your system's operations. You will immediately notice several core attributes:
- **System Hook**: What internal system trigger this template belongs to (e.g., `sales-invoice`, `picking-slip`).
- **Data Context**: What context format the template expects.

### Modifying and Live-Testing Templates

1. Click on any report in the master list (or click **Edit**) to open the Dual-Pane Editor.
2. The Top Panel is the **Source Editor**. Here, you write your raw [Typst](https://typst.app/docs/) layout markup. Typst is a modern, deeply capable typesetting markup language similar to LaTeX, but with native JSON data ingestion. 
3. The Bottom Panel is your **Live Preview**. In order to compile a valid PDF to view the visual results of your markup changes, you need to provide real data.

To preview your changes instantly without leaving the page:
1. Look at the **Target Context** options along the top. 
2. Ensure the correct context is selected (e.g., you are editing the Invoice, so choose `sales-invoice`).
3. Click the **🎲 (Magic Dice)** button next to the **Target Record** input field! The system will automatically select a random, real entry from your current database (e.g., a random Sales Invoice ID).
4. Click **Preview**. The PDF will instantly compile and render inside the viewport!

Whenever you are satisfied with your layout changes, hit **Save Changes**. The very next time your warehouse staff or sales manager clicks 'Print' for that document type anywhere in the HeroBM application, they will seamlessly receive your new design. 

## Best Practices

- Make sure you thoroughly test your template changes by pressing the **🎲 Magic Dice** multiple times to sample different records. For example, some picking slips may have extremely long product descriptions, or some invoices might span multiple pages. Testing various random records ensures your layout correctly handles varying text lengths and pagination.
- Only administrators with the `report:write` permission in the Casbin authorization suite can edit templates.
- If you accidentally corrupt a master file, you can utilize Drizzle database backups to recover it. It is always recommended to copy and paste your working templates into a secure text editor before executing a major rewrite.
