import React, { ReactNode } from 'react';
import styled, { css } from 'styled-components';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const getBadgeStyles = (variant: string, size: string) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: 6px;
  white-space: nowrap;
  
  /* Size variants */
  ${size === 'small' && css`
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  `}
  
  ${size === 'medium' && css`
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  `}
  
  ${size === 'large' && css`
    padding: 0.5rem 1rem;
    font-size: 1rem;
  `}
  
  /* Color variants */
  ${variant === 'default' && css`
    background: #f1f5f9;
    color: #475569;
  `}
  
  ${variant === 'success' && css`
    background: #dcfce7;
    color: #166534;
  `}
  
  ${variant === 'warning' && css`
    background: #fef3c7;
    color: #92400e;
  `}
  
  ${variant === 'error' && css`
    background: #fee2e2;
    color: #991b1b;
  `}
  
  ${variant === 'info' && css`
    background: #dbeafe;
    color: #1d4ed8;
  `}
`;

const StyledBadge = styled.span<{
  variant: string;
  size: string;
}>`
  ${props => getBadgeStyles(props.variant, props.size)}
`;

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'medium',
  className,
}) => {
  return (
    <StyledBadge 
      variant={variant} 
      size={size} 
      className={className}
    >
      {children}
    </StyledBadge>
  );
};

export default Badge;