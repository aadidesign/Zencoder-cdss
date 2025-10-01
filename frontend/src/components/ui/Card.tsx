import React, { ReactNode } from 'react';
import styled from 'styled-components';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'small' | 'medium' | 'large';
  hover?: boolean;
}

const StyledCard = styled.div<{ padding: string; hover: boolean }>`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  
  ${props => props.padding === 'small' && `padding: 1rem;`}
  ${props => props.padding === 'medium' && `padding: 1.5rem;`}
  ${props => props.padding === 'large' && `padding: 2rem;`}
  
  ${props => props.hover && `
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }
  `}
`;

const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'medium',
  hover = false,
}) => {
  return (
    <StyledCard 
      className={className} 
      padding={padding} 
      hover={hover}
    >
      {children}
    </StyledCard>
  );
};

export default Card;