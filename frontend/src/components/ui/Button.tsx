import React, { ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const getButtonStyles = (variant: string, size: string) => css`
  /* Base styles */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  /* Size variants */
  ${size === 'small' && css`
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    min-height: 36px;
  `}
  
  ${size === 'medium' && css`
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    min-height: 44px;
  `}
  
  ${size === 'large' && css`
    padding: 1rem 2rem;
    font-size: 1.125rem;
    min-height: 52px;
  `}

  /* Color variants */
  ${variant === 'primary' && css`
    background: #3b82f6;
    color: white;
    
    &:hover:not(:disabled) {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    
    &:active {
      transform: translateY(0);
    }
  `}
  
  ${variant === 'secondary' && css`
    background: #6b7280;
    color: white;
    
    &:hover:not(:disabled) {
      background: #4b5563;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(107, 114, 128, 0.4);
    }
  `}
  
  ${variant === 'outline' && css`
    background: transparent;
    color: #3b82f6;
    border: 2px solid #3b82f6;
    
    &:hover:not(:disabled) {
      background: #3b82f6;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }
  `}
  
  ${variant === 'danger' && css`
    background: #ef4444;
    color: white;
    
    &:hover:not(:disabled) {
      background: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
  `}

  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  /* Focus state */
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
`;

const StyledButton = styled(motion.button)<{
  variant: string;
  size: string;
}>`
  ${props => getButtonStyles(props.variant, props.size)}
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  
  svg {
    width: 1em;
    height: 1em;
  }
`;

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  onClick,
  type = 'button',
  className,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      className={className}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="small" />
          {children}
        </>
      ) : (
        <>
          {icon && <IconWrapper>{icon}</IconWrapper>}
          {children}
        </>
      )}
    </StyledButton>
  );
};

export default Button;