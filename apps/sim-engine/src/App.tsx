import { useEffect, useState } from 'react';
import './App.css';

interface SimState {
  state: string;
  currentEvent: any;
  registeredAgents: string[];
  pendingAcks: string[];
  upcomingEvents: any[];
}

function App() {
  const [simState, setSimState] = useState<SimState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('http://localhost:3005/api/state');
      const data = await res.json();
      setSimState(data);
    } catch (err) {
      console.error('Failed to fetch state', err);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let playInterval: any;
    if (isPlaying && simState?.state === 'READY') {
      playInterval = setInterval(() => {
        handleStep();
      }, 2000); // 2 second delay between automatic steps
    }
    return () => clearInterval(playInterval);
  }, [isPlaying, simState?.state]);

  const handleStep = async () => {
    try {
      await fetch('http://localhost:3005/api/step', { method: 'POST' });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    try {
      await fetch('http://localhost:3005/api/generate-epoch', { method: 'POST' });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedEventId(prev => (prev === id ? null : id));
  };

  if (!simState) return <div>Loading Simulation Engine...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', color: 'white', backgroundColor: '#1e1e1e', minHeight: '100vh' }}>
      <h1>HeroBM Simulation Engine (Supervisor)</h1>
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Left Column: Controls & State */}
        <div style={{ flex: 1 }}>
          <div style={{ backgroundColor: '#2d2d2d', padding: '1.5rem', borderRadius: '8px' }}>
            <h2>Engine State: <span style={{ color: simState.state === 'READY' ? '#4ade80' : '#facc15' }}>{simState.state}</span></h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={handleGenerate}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Generate Epoch
              </button>
              <button 
                onClick={handleStep}
                disabled={simState.state !== 'READY'}
                style={{ padding: '0.5rem 1rem', background: simState.state === 'READY' ? '#10b981' : '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: simState.state === 'READY' ? 'pointer' : 'not-allowed' }}
              >
                Step
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ padding: '0.5rem 1rem', background: isPlaying ? '#ef4444' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: '#2d2d2d', padding: '1.5rem', borderRadius: '8px', marginTop: '1.5rem' }}>
            <h2>Agent Status</h2>
            <p>Total Registered: {simState.registeredAgents.length}</p>
            {simState.state === 'WAITING_FOR_AGENTS' && (
              <div>
                <p>Waiting on ACKs from:</p>
                <ul>
                  {simState.pendingAcks.map(agent => <li key={agent}>{agent}</li>)}
                </ul>
              </div>
            )}
          </div>

          {simState.currentEvent && (
            <div style={{ backgroundColor: '#2d2d2d', padding: '1.5rem', borderRadius: '8px', marginTop: '1.5rem' }}>
              <h2>Current Event</h2>
              <pre style={{ background: '#000', padding: '1rem', borderRadius: '4px', overflowX: 'auto' }}>
                {JSON.stringify(simState.currentEvent, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Timeline */}
        <div style={{ flex: 1, backgroundColor: '#2d2d2d', padding: '1.5rem', borderRadius: '8px' }}>
          <h2>Upcoming Timeline ({simState.upcomingEvents.length} events)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {simState.upcomingEvents.map((evt: any) => (
              <div key={evt.id} style={{ background: '#3f3f46', padding: '1rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{evt.type}</strong>
                  <span style={{ color: '#a1a1aa' }}>{new Date(evt.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#d4d4d8' }}>
                    ID: {evt.id}
                  </div>
                  <button 
                    onClick={() => toggleExpand(evt.id)}
                    style={{ background: 'transparent', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    {expandedEventId === evt.id ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
                {expandedEventId === evt.id && (
                  <pre style={{ background: '#000', padding: '1rem', borderRadius: '4px', overflowX: 'auto', marginTop: '1rem', fontSize: '0.875rem' }}>
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {simState.upcomingEvents.length === 0 && (
              <p style={{ color: '#a1a1aa' }}>Timeline is empty. Generate an epoch.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
