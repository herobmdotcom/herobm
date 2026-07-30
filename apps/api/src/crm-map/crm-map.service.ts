import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  actors,
  contacts,
  projects,
  actorActorLinks,
  actorContactLinks,
  projectActors,
  projectContacts,
} from '@herobm/db-schema';

@Injectable()
export class CrmMapService {
  private readonly logger = new Logger(CrmMapService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getMapData(focalNodeId?: string, maxDistance: number = 2) {
    const allActors = await this.db.select().from(actors);
    const allContacts = await this.db.select().from(contacts);
    const allProjects = await this.db.select().from(projects);

    const aALinks = await this.db.select().from(actorActorLinks);
    const aCLinks = await this.db.select().from(actorContactLinks);
    const pALinks = await this.db.select().from(projectActors);
    const pCLinks = await this.db.select().from(projectContacts);

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
          projects: allProjects,
        },
        edges: {
          actorActor: aALinks,
          actorContact: aCLinks,
          projectActor: pALinks,
          projectContact: pCLinks,
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
    pALinks.forEach((e) => addEdge(e.projectId, e.actorId));
    pCLinks.forEach((e) => addEdge(e.projectId, e.contactId));

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
    const filteredProjects = allProjects.filter((n) =>
      visitedNodes.has(n.projectId),
    );

    // Filter edges (only keep edges where BOTH source and target are in visitedNodes)
    const filteredAALinks = aALinks.filter(
      (e) =>
        visitedNodes.has(e.sourceActorId) && visitedNodes.has(e.targetActorId),
    );
    const filteredACLinks = aCLinks.filter(
      (e) => visitedNodes.has(e.actorId) && visitedNodes.has(e.contactId),
    );
    const filteredPALinks = pALinks.filter(
      (e) => visitedNodes.has(e.projectId) && visitedNodes.has(e.actorId),
    );
    const filteredPCLinks = pCLinks.filter(
      (e) => visitedNodes.has(e.projectId) && visitedNodes.has(e.contactId),
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
        projects: filteredProjects,
      },
      edges: {
        actorActor: filteredAALinks,
        actorContact: filteredACLinks,
        projectActor: filteredPALinks,
        projectContact: filteredPCLinks,
        referralActorActor,
        referralContactActor,
      },
    };
  }
}
