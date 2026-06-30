import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Timeline } from './timeline';
import { EventType, EVENT_CATALOGUE } from './catalogue';
import type { SimEvent } from './catalogue';
import { WorldState } from './world';
import { fetchProductsFromApi } from './api-client';
import { generateEpoch } from './generate-epoch';

const app = express();
app.use(cors());
app.use(express.json());

const timeline = new Timeline();
const world = new WorldState();

// Fetch products asynchronously
fetchProductsFromApi().then(products => {
  console.log(`[SimEngine] Fetched ${products.length} products from API`);
  world.setProducts(products);
});

// Engine State
let currentState: 'READY' | 'WAITING_FOR_AGENTS' = 'READY';
let currentEvent: SimEvent | null = null;
let registeredAgents: Set<string> = new Set();
let pendingAcks: Set<string> = new Set();
let agentLogs: { timestamp: string; agentId: string; message: string; level: string }[] = [];

const FAKETIME_PATH = process.env.FAKETIME_TIMESTAMP_FILE || '/etc/faketime/faketime.rc';

function updateFaketime(timestampMs: number) {
  try {
    const d = new Date(timestampMs);
    // Format: @YYYY-MM-DD HH:MM:SS
    const formatted = `@${d.toISOString().replace('T', ' ').slice(0, 19)}`;
    fs.mkdirSync(path.dirname(FAKETIME_PATH), { recursive: true });
    fs.writeFileSync(FAKETIME_PATH, formatted);
    console.log(`[SimEngine] Time advanced to ${formatted}`);
  } catch (err) {
    console.error('[SimEngine] Failed to update faketime:', err);
  }
}

// -----------------------------------------
// UI Endpoints (Human Supervisor)
// -----------------------------------------
app.get('/api/state', (_req, res) => {
  res.json({
    state: currentState,
    currentEvent,
    registeredAgents: Array.from(registeredAgents),
    pendingAcks: Array.from(pendingAcks),
    upcomingEvents: timeline.getAllEvents(),
    agentLogs: agentLogs.slice(-100) // return last 100 logs
  });
});

app.post('/api/step', (_req, res) => {
  if (currentState !== 'READY') {
    return res.status(400).json({ error: 'Cannot step, engine is waiting for agents.' });
  }
  
  const event = timeline.popNextEvent();
  if (!event) {
    return res.status(400).json({ error: 'No events in timeline.' });
  }

  updateFaketime(event.timestamp);
  currentEvent = event;
  currentState = 'WAITING_FOR_AGENTS';
  pendingAcks = new Set(registeredAgents);
  
  // If no agents registered, auto-complete
  if (pendingAcks.size === 0) {
    currentState = 'READY';
  }

  res.json({ success: true, event });
});

app.post('/api/generate-epoch', (_req, res) => {
  const timestamp = currentEvent ? currentEvent.timestamp : Date.now();
  generateEpoch(world, timeline, timestamp);
  res.json({ success: true });
});

// -----------------------------------------
// Agent Endpoints
// -----------------------------------------
app.post('/api/sim/register', (req, res) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  registeredAgents.add(agentId);
  res.json({ success: true });
});

app.post('/api/sim/logs', (req, res) => {
  const { agentId, message, level = 'info' } = req.body;
  if (!agentId || !message) return res.status(400).json({ error: 'agentId and message required' });
  agentLogs.push({ timestamp: new Date().toISOString(), agentId, message, level });
  // Keep logs bounded
  if (agentLogs.length > 500) agentLogs = agentLogs.slice(-500);
  res.json({ success: true });
});

app.get('/api/sim/inbox', (_req, res) => {
  if (currentState === 'WAITING_FOR_AGENTS') {
    res.json({ event: currentEvent });
  } else {
    res.json({ event: null });
  }
});

app.post('/api/sim/turn-complete', (req, res) => {
  const { agentId, outcomes } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  
  if (currentState !== 'WAITING_FOR_AGENTS') {
    return res.status(400).json({ error: 'Not currently waiting for agents.' });
  }

  // Process any outcomes reported by the agent
  if (Array.isArray(outcomes)) {
    for (const outcome of outcomes) {
      console.log(`[SimEngine] Agent ${agentId} reported outcome for ${outcome.eventId}: ${outcome.status}`);
      if (outcome.status === 'failure' && outcome.reason?.toLowerCase().includes('credit')) {
        // Find the event to get the virtual IDs
        const evt = currentEvent;
        if (evt && evt.payload?.customer?.id) {
           world.updateCustomerBalanceStatus(evt.payload.customer.id, 'CREDIT_HOLD');
           console.log(`[SimEngine] VirtualCustomer ${evt.payload.customer.id} placed on CREDIT_HOLD`);
        }
      }
    }
  }

  pendingAcks.delete(agentId);
  console.log(`[SimEngine] Agent ${agentId} complete. Remaining: ${pendingAcks.size}`);

  if (pendingAcks.size === 0) {
    currentState = 'READY';
    console.log('[SimEngine] All agents completed turn. Ready for next step.');
  }

  res.json({ success: true, pendingAcks: Array.from(pendingAcks) });
});

// -----------------------------------------
// Webhook Listener (from HeroBM)
// -----------------------------------------
app.post('/api/webhooks', (req, res) => {
  const payload = req.body;
  console.log('[SimEngine] Received webhook:', payload.type);
  
  if (payload.type === 'purchase-order.sent') {
    const now = currentEvent ? currentEvent.timestamp : Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    timeline.addEvent({
      id: Math.random().toString(36).substring(7),
      type: EventType.SUPPLIER_SHIPMENT_ARRIVAL,
      timestamp: now + threeDays,
      payload: { purchaseOrderId: payload.data.id },
      status: 'pending'
    });
    console.log(`[SimEngine] Scheduled SUPPLIER_SHIPMENT_ARRIVAL for PO ${payload.data.id}`);
  } else if (payload.type === 'sales_order.status_changed' && payload.data.status === 'COMPLETED') {
    // Attempt to extract Virtual Order ID from Customer Reference field
    const virtualOrderId = payload.data.customerReference;
    if (virtualOrderId) {
       world.updateOrderStatus(virtualOrderId, 'FULFILLED');
       console.log(`[SimEngine] Virtual Order ${virtualOrderId} marked as FULFILLED, eligible for return.`);
    }
  }

  res.json({ success: true });
});

// Serve frontend
app.use(express.static(path.join(process.cwd(), 'dist')));
app.use((_req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist/index.html'));
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Simulation Engine running on port ${PORT}`);
});
