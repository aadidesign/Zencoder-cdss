import React from 'react';
import styled, { keyframes } from 'styled-components';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Spinner = styled.div<{ size: string; color: string }>`
  border: 2px solid #f3f3f3;
  border-top: 2px solid ${props => props.color};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  
  ${props => props.size === 'small' && `
    width: 16px;
    height: 16px;
    border-width: 2px;
  `}
  
  ${props => props.size === 'medium' && `
    width: 32px;
    height: 32px;
    border-width: 3px;
  `}
  
  ${props => props.size === 'large' && `
    width: 48px;
    height: 48px;
    border-width: 4px;
  `}
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = '#3b82f6',
  className,
}) => {
  return (
    <Container className={className}>
      <Spinner size={size} color={color} />
    </Container>
  );
};

export default LoadingSpinner;