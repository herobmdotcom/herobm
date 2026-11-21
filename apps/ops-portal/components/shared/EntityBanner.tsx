import React from 'react';
interface EntityBannerProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EntityBanner({ type = 'info', title, description, action }: EntityBannerProps) {
  const iconMap = {
    info: (
      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
      </svg>
    ),
    success: (
      <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
      </svg>
    ),
  };

  const colorMap = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-800/60 dark:text-yellow-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300',
  };

  return (
    <div className={`rounded-md p-4 border mb-6 ${colorMap[type]}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {iconMap[type]}
        </div>
        <div className="ml-3 flex-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            {description && (
              <div className="mt-1 text-sm opacity-90">
                {description}
              </div>
            )}
          </div>
          {action && (
            <div className="ml-4 flex-shrink-0">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
