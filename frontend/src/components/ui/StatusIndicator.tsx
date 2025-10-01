import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

const StatusContainer = styled(motion.div)<{ 
  status: 'healthy' | 'warning' | 'error' | 'loading';
  size: 'small' | 'medium' | 'large';
}>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .status-icon {
    color: ${props => 
      props.status === 'healthy' ? '#10b981' :
      props.status === 'warning' ? '#f59e0b' :
      props.status === 'error' ? '#ef4444' :
      '#6b7280'
    };
    
    ${props => props.size === 'small' && 'width: 16px; height: 16px;'}
    ${props => props.size === 'medium' && 'width: 20px; height: 20px;'}
    ${props => props.size === 'large' && 'width: 24px; height: 24px;'}
  }
  
  .status-pulse {
    animation: ${props => props.status === 'loading' ? 'pulse 2s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const StatusText = styled.span<{ status: 'healthy' | 'warning' | 'error' | 'loading' }>`
  font-weight: 500;
  color: ${props => 
    props.status === 'healthy' ? '#10b981' :
    props.status === 'warning' ? '#f59e0b' :
    props.status === 'error' ? '#ef4444' :
    '#6b7280'
  };
  text-transform: capitalize;
`;

interface StatusIndicatorProps {
  status: 'healthy' | 'warning' | 'error' | 'loading';
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  customText?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'medium',
  showText = false,
  icon,
  customText
}) => {
  const getDefaultIcon = () => {
    switch (status) {
      case 'healthy':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return XCircle;
      case 'loading':
        return Clock;
      default:
        return CheckCircle;
    }
  };

  const IconComponent = icon || getDefaultIcon();
  const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;

  return (
    <StatusContainer
      status={status}
      size={size}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <IconComponent 
        size={iconSize} 
        className={`status-icon ${status === 'loading' ? 'status-pulse' : ''}`}
      />
      {showText && (
        <StatusText status={status}>
          {customText || status}
        </StatusText>
      )}
    </StatusContainer>
  );
};