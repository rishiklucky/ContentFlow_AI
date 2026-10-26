import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'vermilion'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon: Icon = null,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const variantClass = {
    primary: 'cf-btn-primary',
    secondary: 'cf-btn-secondary',
    outline: 'cf-btn-outline',
    vermilion: 'cf-btn-vermilion',
  }[variant] || 'cf-btn-primary';

  const sizeClass = {
    sm: 'cf-btn-sm',
    md: '',
    lg: 'cf-btn-lg',
  }[size] || '';

  return (
    <button
      type={type}
      className={`cf-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
      <span>{children}</span>
    </button>
  );
}
