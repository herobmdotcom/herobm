import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  actors,
  contacts,
  opportunities,
  actorActorLinks,
  actorContactLinks,
  opportunityActors,
  opportunityContacts,
} from '@herobm/db-schema';

@Injectable()
export class CrmMapService {
  private readonly logger = new Logger(CrmMapService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getMapData(focalNodeId?: string, maxDistance: number = 2) {
    const allActors = await this.db.select().from(actors);
    const allContacts = await this.db.select().from(contacts);
    const allOpportunities = await this.db.select().from(opportunities);

    const aALinks = await this.db.select().from(actorActorLinks);
    const aCLinks = await this.db.select().from(actorContactLinks);
    const oALinks = await this.db.select().from(opportunityActors);
    const oCLinks = await this.db.select().from(opportunityContacts);

    if (!focalNodeId) {
      const referralActorActor = allActors
        .filter((a) => a.referredByActorId)
        .map((a) => ({
          sourceActorId: a.referredByActorId!,
          targetActorId: a.actorId,
        }));
      const referralContactActor = allActors
        .filter((a) => a.referredByContactId)
        .map((a) => ({
          contactId: a.referredByContactId!,
          actorId: a.actorId,
        }));

      return {
        nodes: {
          actors: allActors,
          contacts: allContacts,
          opportunities: allOpportunities,
        },
        edges: {
          actorActor: aALinks,
          actorContact: aCLinks,
          opportunityActor: oALinks,
          opportunityContact: oCLinks,
          referralActorActor,
          referralContactActor,
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

    aALinks.forEach((e) => addEdge(e.sourceActorId, e.targetActorId));
    aCLinks.forEach((e) => addEdge(e.actorId, e.contactId));
    oALinks.forEach((e) => addEdge(e.opportunityId, e.actorId));
    oCLinks.forEach((e) => addEdge(e.opportunityId, e.contactId));

    allActors.forEach((a) => {
      if (a.referredByActorId) addEdge(a.actorId, a.referredByActorId);
      if (a.referredByContactId) addEdge(a.actorId, a.referredByContactId);
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
    const filteredActors = allActors.filter((n) => visitedNodes.has(n.actorId));
    const filteredContacts = allContacts.filter((n) =>
      visitedNodes.has(n.contactId),
    );
    const filteredOpportunities = allOpportunities.filter((n) =>
      visitedNodes.has(n.opportunityId),
    );

    // Filter edges (only keep edges where BOTH source and target are in visitedNodes)
    const filteredAALinks = aALinks.filter(
      (e) =>
        visitedNodes.has(e.sourceActorId) && visitedNodes.has(e.targetActorId),
    );
    const filteredACLinks = aCLinks.filter(
      (e) => visitedNodes.has(e.actorId) && visitedNodes.has(e.contactId),
    );
    const filteredOALinks = oALinks.filter(
      (e) => visitedNodes.has(e.opportunityId) && visitedNodes.has(e.actorId),
    );
    const filteredOCLinks = oCLinks.filter(
      (e) => visitedNodes.has(e.opportunityId) && visitedNodes.has(e.contactId),
    );

    const referralActorActor = filteredActors
      .filter(
        (a) => a.referredByActorId && visitedNodes.has(a.referredByActorId),
      )
      .map((a) => ({
        sourceActorId: a.referredByActorId!,
        targetActorId: a.actorId,
      }));

    const referralContactActor = filteredActors
      .filter(
        (a) => a.referredByContactId && visitedNodes.has(a.referredByContactId),
      )
      .map((a) => ({
        contactId: a.referredByContactId!,
        actorId: a.actorId,
      }));

    return {
      nodes: {
        actors: filteredActors,
        contacts: filteredContacts,
        opportunities: filteredOpportunities,
      },
      edges: {
        actorActor: filteredAALinks,
        actorContact: filteredACLinks,
        opportunityActor: filteredOALinks,
        opportunityContact: filteredOCLinks,
        referralActorActor,
        referralContactActor,
      },
    };
  }
}
