'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import SetupWizard from './components/SetupWizard';

function SetupGate() {
  const params = useSearchParams();
  const token = params.get('token');
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setAuthed(false);
      return;
    }

    // Attempting a simple GET against a setup route verifies the token because
    // lib/api.ts automatically intercepts '/api/setup/*' and injects the token query.
    apiFetch('/api/setup/status')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, [token]);

  if (authed === null) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 font-medium">
        <span className="w-5 h-5 mr-3 border-2 border-[#006b5c] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        Verifying secure token...
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="w-full max-w-lg text-center p-12 bg-white rounded-2xl shadow-sm border border-red-200">
         <div className="w-16 h-16 mx-auto bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
             <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
           </svg>
         </div>
         <h2 className="text-2xl font-bold text-slate-900 mb-3">Unauthorized Access</h2>
         <p className="text-slate-600 mb-6 border bg-slate-50 border-slate-200 p-4 rounded-lg font-mono text-sm leading-relaxed text-left">
           This installation portal strictly requires a one-time cryptographic token. <br/><br/>
           Please run <strong className="text-slate-800">make setup-wizard</strong> inside the host system CLI to generate a valid secure link.
         </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-10 flex flex-col items-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-[#006b5c] text-[#006b5c]">
            <span className="text-3xl font-bold font-sans">H</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">herobm</h1>
        </div>
        <p className="text-slate-500 font-medium text-lg mt-1">Initialize your business OS environment</p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
        <SetupWizard />
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#f8fafc] text-slate-900 font-sans">
      <Suspense fallback={
        <div className="text-slate-400 font-medium flex items-center">
          <span className="w-5 h-5 mr-3 border-2 border-[#006b5c] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Loading wizard...
        </div>
      }>
        <SetupGate />
      </Suspense>
    </div>
  );
}
