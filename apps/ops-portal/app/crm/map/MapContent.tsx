/* eslint-disable @typescript-eslint/no-explicit-any -- Temporary workaround for ReactFlow typing complexity */
'use client';
import { reportError } from '@/lib/api';

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/shared/Button';
import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const nodeWidth = 250;
  const nodeHeight = 80;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const sourceNode = dagreGraph.node(edge.source);
    const targetNode = dagreGraph.node(edge.target);
    
    let sourceHandle = 'bottom-source';
    let targetHandle = 'top-target';

    if (sourceNode && targetNode) {
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;

      if (Math.abs(dy) < 50) {
        // Mostly horizontal
        if (dx > 0) {
          sourceHandle = 'right-source';
          targetHandle = 'left-target';
        } else {
          sourceHandle = 'left-source';
          targetHandle = 'right-target';
        }
      } else if (dy < 0) {
        // Target is ABOVE Source
        sourceHandle = 'top-source';
        targetHandle = 'bottom-target';
      }
    }
    
    return { ...edge, sourceHandle, targetHandle };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

const ActorNode = ({ data }: any) => (
  <div className="px-4 py-2 rounded-md relative group w-[250px] min-h-[80px] flex flex-col justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
    <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
    <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
    <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
    <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
    <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
    <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
    <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

    <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
      <Link href={`/crm/actors/${data.rawId}`} className="font-bold text-sm hover:underline line-clamp-2" style={{ color: 'var(--text-primary)' }} title={data.label}>
        🏢 {data.label}
      </Link>
      {data.industry && <div className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }} title={data.industry}>{data.industry}</div>}
    </div>
    
    <Button 
      onClick={() => data.onExpand(data.rawId)} 
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
      title="Expand connections"
    >
      +
    </Button>
  </div>
);

const ContactNode = ({ data }: any) => (
  <div className="px-4 py-2 rounded-full relative group w-[250px] min-h-[80px] flex items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
    <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
    <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
    <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
    <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
    <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
    <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
    <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

    <div className="flex items-center justify-center font-bold text-sm relative z-10 w-full px-6 overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      <Link href={`/crm/contacts/${data.rawId}`} className="hover:underline line-clamp-2 w-full text-center" title={data.label}>
        👤 {data.label}
      </Link>
    </div>

    <Button 
      onClick={() => data.onExpand(data.rawId)} 
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
      title="Expand connections"
    >
      +
    </Button>
  </div>
);

const ProjectNode = ({ data }: any) => (
  <div className="px-4 py-2 rounded-lg relative group w-[250px] min-h-[80px] flex items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
    <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
    <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
    <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
    <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
    <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
    <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
    <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

    <div className="flex items-center justify-center font-bold text-sm relative z-10 w-full px-6 overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      <Link href={`/crm/projects/${data.rawId}`} className="hover:underline line-clamp-2 w-full text-center" title={data.label}>
        📁 {data.label}
      </Link>
    </div>

    <Button 
      onClick={() => data.onExpand(data.rawId)} 
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
      title="Expand connections"
    >
      +
    </Button>
  </div>
);

const nodeTypes = {
  actor: ActorNode,
  contact: ContactNode,
  project: ProjectNode,
};

import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import * as api from '@herobm/sdk';

export default function MapContent() {
  const [focalNodeId, setFocalNodeId] = useState<string>('');
  
  // Fetch graph data
  const { data: mapData, isLoading, error } = useSWR(
    focalNodeId ? ['crm-map', focalNodeId] : null,
    async () => {
      const { data } = await api.crmMapControllerGetMap({ focalNodeId, maxDistance: 2 });
      return data;
    }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isExpanding, setIsExpanding] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  // Sync refs with state without triggering effects
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const processPayload = useCallback((payload: any, onExpandCb: (id: string) => void) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    payload.nodes.actors?.forEach((a: any) => {
      newNodes.push({
        id: `actor-${a.actorId}`,
        type: 'actor',
        position: { x: 0, y: 0 },
        data: { label: a.name, industry: a.industry, rawId: a.actorId, onExpand: onExpandCb },
      });
    });

    payload.nodes.contacts?.forEach((c: any) => {
      newNodes.push({
        id: `contact-${c.contactId}`,
        type: 'contact',
        position: { x: 0, y: 0 },
        data: { label: `${c.firstName} ${c.lastName}`, rawId: c.contactId, onExpand: onExpandCb },
      });
    });

    payload.nodes.projects?.forEach((p: any) => {
      newNodes.push({
        id: `project-${p.projectId}`,
        type: 'project',
        position: { x: 0, y: 0 },
        data: { label: p.title || p.name || 'Project', rawId: p.projectId, onExpand: onExpandCb },
      });
    });

    payload.edges.actorActor?.forEach((e: any) => {
      newEdges.push({
        id: `aa-${e.sourceActorId}-${e.targetActorId}`,
        source: `actor-${e.sourceActorId}`,
        target: `actor-${e.targetActorId}`,
        animated: true,
      });
    });

    payload.edges.actorContact?.forEach((e: any) => {
      newEdges.push({
        id: `ac-${e.actorId}-${e.contactId}`,
        source: `actor-${e.actorId}`,
        target: `contact-${e.contactId}`,
        label: e.primaryFor?.length ? `Primary for: ${e.primaryFor.join(', ')}` : undefined,
      });
    });

    payload.edges.projectActor?.forEach((e: any) => {
      newEdges.push({
        id: `pa-${e.projectId}-${e.actorId}`,
        source: `project-${e.projectId}`,
        target: `actor-${e.actorId}`,
        label: e.roles?.length ? e.roles.join(', ') : undefined,
      });
    });

    payload.edges.projectContact?.forEach((e: any) => {
      newEdges.push({
        id: `pc-${e.projectId}-${e.contactId}`,
        source: `project-${e.projectId}`,
        target: `contact-${e.contactId}`,
        label: e.roles?.length ? e.roles.join(', ') : undefined,
      });
    });

    payload.edges.referralActorActor?.forEach((e: any) => {
      newEdges.push({
        id: `ref-aa-${e.sourceActorId}-${e.targetActorId}`,
        source: `actor-${e.sourceActorId}`,
        target: `actor-${e.targetActorId}`,
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' },
        label: 'Referred By',
      });
    });

    payload.edges.referralContactActor?.forEach((e: any) => {
      newEdges.push({
        id: `ref-ca-${e.contactId}-${e.actorId}`,
        source: `contact-${e.contactId}`,
        target: `actor-${e.actorId}`,
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' },
        label: 'Referred By',
      });
    });

    return { newNodes, newEdges };
  }, []);

  const handleExpand = useCallback(async (rawId: string) => {
    try {
      setIsExpanding(true);
      const { data: payload } = await api.crmMapControllerGetMap({ focalNodeId: rawId, maxDistance: 1 });
      
      if (payload && payload.nodes && payload.edges) {
        const currentNodes = nodesRef.current;
        const currentEdges = edgesRef.current;

        const { newNodes, newEdges } = processPayload(payload, handleExpand);
        
        const uniqueNodes = [...currentNodes, ...newNodes.filter(n => !currentNodes.some(pn => pn.id === n.id))];
        const uniqueEdges = [...currentEdges, ...newEdges.filter(e => !currentEdges.some(pe => pe.id === e.id))];
        
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(uniqueNodes, uniqueEdges);
        
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      }
    } catch (err) {
      reportError(err, 'MapContent.tsx - Error expanding node');
    } finally {
      setIsExpanding(false);
    }
  }, [processPayload, setNodes, setEdges]);

  useEffect(() => {
    if (!mapData || !mapData.nodes || !mapData.edges) return;

    const { newNodes, newEdges } = processPayload(mapData, handleExpand);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [mapData, processPayload, handleExpand, setNodes, setEdges]);

  return (
    <div className="flex flex-col h-full rounded-lg shadow p-4 bg-white" style={{ background: 'var(--bg-card)' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>CRM Map</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Center on Actor:</label>
          <div className="w-80">
            <ActorSelect 
              value={focalNodeId}
              onChange={(actor: Actor | null) => setFocalNodeId(actor?.actorId || '')}
              placeholder="Search for an Actor..."
            />
          </div>
          {focalNodeId && (
            <Button variant="secondary" onClick={() => setFocalNodeId('')}>Clear</Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 w-full h-[800px] rounded overflow-hidden relative" style={{ background: 'var(--bg-secondary)' }}>
        {!focalNodeId ? (
          <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            Search and select an Actor above to view their relationship map.
          </div>
        ) : error ? (
          <div className="flex flex-col h-full items-center justify-center" style={{ color: 'var(--danger)' }}>
            <div>Error loading map data</div>
            <div className="text-xs mt-2 opacity-75">{error.message || String(error)}</div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading Map Data...</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: '#ffffff' }}
          >
            <Background color="#ccc" gap={16} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
