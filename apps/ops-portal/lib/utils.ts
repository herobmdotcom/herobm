import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBadgeColor(text: string): string {
  if (!text) return 'bg-gray-100 text-gray-800 dark:bg-slate-800/60 dark:text-slate-300 dark:border dark:border-slate-700/50';
  
  // Specific fallbacks for common roles
  const r = text.toLowerCase();
  switch (r) {
    case 'target': return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 dark:border dark:border-rose-500/30';
    case 'buyer': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border dark:border-emerald-500/30';
    case 'seller': return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:border dark:border-amber-500/30';
    case 'advisor': return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 dark:border dark:border-blue-500/30';
    case 'purchasing': return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 dark:border dark:border-blue-500/30';
    case 'billing': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border dark:border-emerald-500/30';
    case 'sales': return 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 dark:border dark:border-orange-500/30';
    case 'technical': return 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 dark:border dark:border-purple-500/30';
    case 'stakeholder': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border dark:border-indigo-500/30';
    case 'project_manager': return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 dark:border dark:border-rose-500/30';
    case 'sponsor': return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:border dark:border-amber-500/30';
  }

  // Deterministic hash for dynamic roles
  const colors = [
    'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300 dark:border dark:border-red-500/30',
    'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 dark:border dark:border-orange-500/30',
    'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:border dark:border-amber-500/30',
    'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300 dark:border dark:border-lime-500/30',
    'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300 dark:border dark:border-green-500/30',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border dark:border-emerald-500/30',
    'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 dark:border dark:border-teal-500/30',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border dark:border-cyan-500/30',
    'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 dark:border dark:border-sky-500/30',
    'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 dark:border dark:border-blue-500/30',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border dark:border-indigo-500/30',
    'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300 dark:border dark:border-violet-500/30',
    'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 dark:border dark:border-purple-500/30',
    'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border dark:border-fuchsia-500/30',
    'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300 dark:border dark:border-pink-500/30',
    'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 dark:border dark:border-rose-500/30',
  ];

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
