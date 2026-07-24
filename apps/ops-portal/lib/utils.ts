import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBadgeColor(text: string): string {
  if (!text) return 'bg-gray-100 text-gray-800';
  
  // Specific fallbacks for common roles
  const r = text.toLowerCase();
  switch (r) {
    case 'target': return 'bg-rose-100 text-rose-800';
    case 'buyer': return 'bg-emerald-100 text-emerald-800';
    case 'seller': return 'bg-amber-100 text-amber-800';
    case 'advisor': return 'bg-blue-100 text-blue-800';
    case 'purchasing': return 'bg-blue-100 text-blue-800';
    case 'billing': return 'bg-emerald-100 text-emerald-800';
    case 'sales': return 'bg-orange-100 text-orange-800';
    case 'technical': return 'bg-purple-100 text-purple-800';
    case 'stakeholder': return 'bg-indigo-100 text-indigo-800';
    case 'project_manager': return 'bg-rose-100 text-rose-800';
    case 'sponsor': return 'bg-amber-100 text-amber-800';
  }

  // Deterministic hash for dynamic roles
  const colors = [
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-amber-100 text-amber-800',
    'bg-lime-100 text-lime-800',
    'bg-green-100 text-green-800',
    'bg-emerald-100 text-emerald-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-sky-100 text-sky-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-violet-100 text-violet-800',
    'bg-purple-100 text-purple-800',
    'bg-fuchsia-100 text-fuchsia-800',
    'bg-pink-100 text-pink-800',
    'bg-rose-100 text-rose-800',
  ];

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
