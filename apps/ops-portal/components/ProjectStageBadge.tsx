import React from 'react';

interface ProjectStageBadgeProps {
  stage: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ProjectStageBadge({
  stage,
  size = 'md',
  className = '',
}: ProjectStageBadgeProps) {
  if (!stage) return null;

  const sizeClass = size === 'sm' ? 'badge-sm' : '';

  return (
    <span className={`badge badge-stage ${sizeClass} ${className}`.trim()}>
      {stage}
    </span>
  );
}
