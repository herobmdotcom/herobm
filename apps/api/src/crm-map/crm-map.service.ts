import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  organizations,
  contacts,
  opportunities,
  organizationOrganizationLinks,
  organizationContactLinks,
  opportunityOrganizations,
  opportunityContacts,
  salesOrders,
  projects,
  customers,
} from '@herobm/db-schema';

@Injectable()
export class CrmMapService {
  private readonly logger = new Logger(CrmMapService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getMapData(focalNodeId?: string, maxDistance: number = 2) {
    const allOrganizations = await this.db.select().from(organizations);
    const allContacts = await this.db.select().from(contacts);
    const allOpportunities = await this.db.select().from(opportunities);
    const allCustomers = await this.db.select().from(customers);
    const allSalesOrders = await this.db.select().from(salesOrders);
    const allProjects = await this.db.select().from(projects);

    const oOLinks = await this.db.select().from(organizationOrganizationLinks);
    const oCLinks = await this.db.select().from(organizationContactLinks);
    const oppOLinks = await this.db.select().from(opportunityOrganizations);
    const oppCLinks = await this.db.select().from(opportunityContacts);

    const customerToOrgMap = new Map<string, string>();
    allCustomers.forEach((c) => {
      if (c.customerId && c.organizationId) {
        customerToOrgMap.set(c.customerId, c.organizationId);
      }
    });

    const orgSOLinks = allSalesOrders
      .filter((so) => so.customerId && customerToOrgMap.has(so.customerId))
      .map((so) => ({
        organizationId: customerToOrgMap.get(so.customerId!)!,
        salesOrderId: so.salesOrderId,
      }));

    const oppSOLinks = allSalesOrders
      .filter((so) => so.opportunityId)
      .map((so) => ({
        opportunityId: so.opportunityId!,
        salesOrderId: so.salesOrderId,
      }));

    const orgProjLinks = allProjects
      .filter((p) => p.customerId && customerToOrgMap.has(p.customerId))
      .map((p) => ({
        organizationId: customerToOrgMap.get(p.customerId)!,
        projectId: p.projectId,
      }));

    const oppProjLinks = allProjects
      .filter((p) => p.opportunityId)
      .map((p) => ({
        opportunityId: p.opportunityId!,
        projectId: p.projectId,
      }));

    if (!focalNodeId) {
      const referralOrganizationOrganization = allOrganizations
        .filter((a) => a.referredByOrganizationId)
        .map((a) => ({
          sourceOrganizationId: a.referredByOrganizationId!,
          targetOrganizationId: a.organizationId,
        }));
      const referralContactOrganization = allOrganizations
        .filter((a) => a.referredByContactId)
        .map((a) => ({
          contactId: a.referredByContactId!,
          organizationId: a.organizationId,
        }));

      return {
        nodes: {
          organizations: allOrganizations,
          contacts: allContacts,
          opportunities: allOpportunities,
          salesOrders: allSalesOrders.map((so) => ({
            salesOrderId: so.salesOrderId,
            orderNumber: so.orderNumber,
            stateCode: so.stateCode,
            baseTotalAmount: so.baseTotalAmount,
            currencyCode: so.currencyCode,
            name: so.name,
            createdOn: so.createdOn,
          })),
          projects: allProjects.map((p) => ({
            projectId: p.projectId,
            projectNumber: p.projectNumber,
            name: p.name,
            stateCode: p.stateCode,
            stage: p.stage,
            billingType: p.billingType,
          })),
        },
        edges: {
          organizationOrganization: oOLinks,
          organizationContact: oCLinks,
          opportunityOrganization: oppOLinks,
          opportunityContact: oppCLinks,
          referralOrganizationOrganization,
          referralContactOrganization,
          organizationSalesOrder: orgSOLinks,
          opportunitySalesOrder: oppSOLinks,
          organizationProject: orgProjLinks,
          opportunityProject: oppProjLinks,
        },
      };
    }

    // BFS Filtering
    const visitedNodes = new Set<string>();
    const queue: { id: string; distance: number }[] = [
      { id: focalNodeId, distance: 0 },
    ];

    // Adjacency list
    const adj: Record<string, string[]> = {};
    const addEdge = (u: string, v: string) => {
      if (!adj[u]) adj[u] = [];
      if (!adj[v]) adj[v] = [];
      adj[u].push(v);
      adj[v].push(u);
    };

    oOLinks.forEach((e) =>
      addEdge(e.sourceOrganizationId, e.targetOrganizationId),
    );
    oCLinks.forEach((e) => addEdge(e.organizationId, e.contactId));
    oppOLinks.forEach((e) => addEdge(e.opportunityId, e.organizationId));
    oppCLinks.forEach((e) => addEdge(e.opportunityId, e.contactId));
    orgSOLinks.forEach((e) => addEdge(e.organizationId, e.salesOrderId));
    oppSOLinks.forEach((e) => addEdge(e.opportunityId, e.salesOrderId));
    orgProjLinks.forEach((e) => addEdge(e.organizationId, e.projectId));
    oppProjLinks.forEach((e) => addEdge(e.opportunityId, e.projectId));

    allOrganizations.forEach((a) => {
      if (a.referredByOrganizationId)
        addEdge(a.organizationId, a.referredByOrganizationId);
      if (a.referredByContactId)
        addEdge(a.organizationId, a.referredByContactId);
    });

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;
      if (visitedNodes.has(id)) continue;

      visitedNodes.add(id);

      if (distance < maxDistance) {
        const neighbors = adj[id] || [];
        for (const n of neighbors) {
          if (!visitedNodes.has(n)) {
            queue.push({ id: n, distance: distance + 1 });
          }
        }
      }
    }

    // Filter nodes
    const filteredOrganizations = allOrganizations.filter((n) =>
      visitedNodes.has(n.organizationId),
    );
    const filteredContacts = allContacts.filter((n) =>
      visitedNodes.has(n.contactId),
    );
    const filteredOpportunities = allOpportunities.filter((n) =>
      visitedNodes.has(n.opportunityId),
    );
    const filteredSalesOrders = allSalesOrders
      .filter((so) => visitedNodes.has(so.salesOrderId))
      .map((so) => ({
        salesOrderId: so.salesOrderId,
        orderNumber: so.orderNumber,
        stateCode: so.stateCode,
        baseTotalAmount: so.baseTotalAmount,
        currencyCode: so.currencyCode,
        name: so.name,
        createdOn: so.createdOn,
      }));
    const filteredProjects = allProjects
      .filter((p) => visitedNodes.has(p.projectId))
      .map((p) => ({
        projectId: p.projectId,
        projectNumber: p.projectNumber,
        name: p.name,
        stateCode: p.stateCode,
        stage: p.stage,
        billingType: p.billingType,
      }));

    // Filter edges (only keep edges where BOTH source and target are in visitedNodes)
    const filteredOOLinks = oOLinks.filter(
      (e) =>
        visitedNodes.has(e.sourceOrganizationId) &&
        visitedNodes.has(e.targetOrganizationId),
    );
    const filteredOCLinks = oCLinks.filter(
      (e) =>
        visitedNodes.has(e.organizationId) && visitedNodes.has(e.contactId),
    );
    const filteredOppOLinks = oppOLinks.filter(
      (e) =>
        visitedNodes.has(e.opportunityId) && visitedNodes.has(e.organizationId),
    );
    const filteredOppCLinks = oppCLinks.filter(
      (e) => visitedNodes.has(e.opportunityId) && visitedNodes.has(e.contactId),
    );
    const filteredOrgSOLinks = orgSOLinks.filter(
      (e) =>
        visitedNodes.has(e.organizationId) && visitedNodes.has(e.salesOrderId),
    );
    const filteredOppSOLinks = oppSOLinks.filter(
      (e) =>
        visitedNodes.has(e.opportunityId) && visitedNodes.has(e.salesOrderId),
    );
    const filteredOrgProjLinks = orgProjLinks.filter(
      (e) =>
        visitedNodes.has(e.organizationId) && visitedNodes.has(e.projectId),
    );
    const filteredOppProjLinks = oppProjLinks.filter(
      (e) => visitedNodes.has(e.opportunityId) && visitedNodes.has(e.projectId),
    );

    const referralOrganizationOrganization = filteredOrganizations
      .filter(
        (a) =>
          a.referredByOrganizationId &&
          visitedNodes.has(a.referredByOrganizationId),
      )
      .map((a) => ({
        sourceOrganizationId: a.referredByOrganizationId!,
        targetOrganizationId: a.organizationId,
      }));

    const referralContactOrganization = filteredOrganizations
      .filter(
        (a) => a.referredByContactId && visitedNodes.has(a.referredByContactId),
      )
      .map((a) => ({
        contactId: a.referredByContactId!,
        organizationId: a.organizationId,
      }));

    return {
      nodes: {
        organizations: filteredOrganizations,
        contacts: filteredContacts,
        opportunities: filteredOpportunities,
        salesOrders: filteredSalesOrders,
        projects: filteredProjects,
      },
      edges: {
        organizationOrganization: filteredOOLinks,
        organizationContact: filteredOCLinks,
        opportunityOrganization: filteredOppOLinks,
        opportunityContact: filteredOppCLinks,
        referralOrganizationOrganization,
        referralContactOrganization,
        organizationSalesOrder: filteredOrgSOLinks,
        opportunitySalesOrder: filteredOppSOLinks,
        organizationProject: filteredOrgProjLinks,
        opportunityProject: filteredOppProjLinks,
      },
    };
  }
}
