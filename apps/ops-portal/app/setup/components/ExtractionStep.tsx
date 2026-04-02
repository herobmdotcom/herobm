'use client';

import { useState } from 'react';
import { apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  updateConfig: (updates: Partial<ConfigState>) => void;
  onNext: () => void;
}

export default function ExtractionStep({ config, updateConfig, onNext }: Props) {
  const [loading, setLoading] = useState(false);
  
  const isFormValid = config.host.trim() !== '' && 
                      config.port.trim() !== '' && 
                      config.database.trim() !== '' && 
                      config.username.trim() !== '';

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const res = await apiMutate<any>('/api/setup/test-abm', 'POST', {
        host: config.host,
        port: parseInt(config.port, 10),
        database: config.database,
        username: config.username,
        password: config.password || '',
      });
      
      if (res.success === false) {
        toast.error(res.message || 'Connection Failed');
      } else {
        toast.success(res.message || 'Connection Verified');
        onNext();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to communicate with API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Source Pipeline Sync</h2>
        <p className="text-slate-500">
          Connect to an Advanced Business Manager MSSQL database to migrate historical accounting, inventory, and sales data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Host</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="localhost"
            value={config.host}
            onChange={(e) => updateConfig({ host: e.target.value })}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Port</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="1433"
            value={config.port}
            onChange={(e) => updateConfig({ port: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Database Name (ABM)</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="Company_DB"
          value={config.database}
          onChange={(e) => updateConfig({ database: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Username</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="admin"
            value={config.username}
            onChange={(e) => updateConfig({ username: e.target.value })}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Password</label>
          <input
            type="password"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.password || ''}
            onChange={(e) => updateConfig({ password: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <input
          type="checkbox"
          id="resumeCheck"
          className="w-5 h-5 rounded border-slate-300 text-[#006b5c] focus:ring-[#006b5c]"
          checked={config.resume}
          onChange={(e) => updateConfig({ resume: e.target.checked })}
          disabled={loading}
        />
        <label htmlFor="resumeCheck" className="text-slate-800 font-medium cursor-pointer">
          Resume interrupted extraction <span className="text-slate-400 font-normal">(Skips fully loaded tables)</span>
        </label>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-100">
        <button 
          onClick={() => { updateConfig({ emptyBase: true }); onNext(); }}
          className="text-slate-500 hover:text-slate-800 font-medium"
          disabled={loading}
        >
          Skip extraction (Empty Base)
        </button>
        <button
          onClick={handleTestConnection}
          disabled={!isFormValid || loading}
          className={`px-8 py-3 rounded-lg font-bold transition-colors shadow-sm ${
            !isFormValid || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#006b5c] hover:bg-[#005246] text-white cursor-pointer'
          }`}
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}
