import React from 'react';

export default function Badge({
  children,
  variant = 'default', // 'default' | 'vermilion' | 'prussian' | 'green' | 'dark' | 'stamp'
  className = '',
  icon: Icon = null,
}) {
  if (variant === 'stamp') {
    return (
      <span className={`stamp-badge ${className}`}>
        {children}
      </span>
    );
  }

  const variantClass = {
    default: '',
    vermilion: 'cf-badge-vermilion',
    prussian: 'cf-badge-prussian',
    green: 'cf-badge-green',
    dark: 'cf-badge-dark',
  }[variant] || '';

  return (
    <span className={`cf-badge ${variantClass} ${className}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
