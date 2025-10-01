import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

const CardContainer = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CardTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CardIcon = styled.div<{ color?: string }>`
  color: ${props => props.color || '#3b82f6'};
  opacity: 0.8;
`;

const ValueSection = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const MainValue = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
`;

const Unit = styled.span`
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
`;

const ChangeIndicator = styled.div<{ 
  trend: 'up' | 'down' | 'neutral';
  positive?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  
  color: ${props => {
    if (props.trend === 'neutral') return '#64748b';
    
    const isGoodChange = props.positive ?? (props.trend === 'up');
    return isGoodChange ? '#10b981' : '#ef4444';
  }};
`;

const ChangeValue = styled.span`
  font-weight: 600;
`;

const ChangeLabel = styled.span`
  font-weight: 400;
`;

const ProgressBar = styled.div<{ 
  percentage: number;
  color?: string;
}>`
  width: 100%;
  height: 4px;
  background: #f1f5f9;
  border-radius: 2px;
  margin-top: 1rem;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${props => Math.min(props.percentage, 100)}%;
    background: ${props => props.color || '#3b82f6'};
    border-radius: 2px;
    transition: width 0.5s ease;
  }
`;

const SubMetrics = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
`;

const SubMetric = styled.div`
  text-align: center;
  
  .label {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-bottom: 0.25rem;
  }
  
  .value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }
`;

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  icon?: React.ReactNode;
  change?: {
    value: number;
    label: string;
    trend: 'up' | 'down' | 'neutral';
    positive?: boolean; // Whether the trend direction is considered positive
  };
  showProgress?: boolean;
  progressPercentage?: number;
  progressColor?: string;
  subMetrics?: Array<{
    label: string;
    value: string | number;
  }>;
  decimals?: number;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  change,
  showProgress = false,
  progressPercentage,
  progressColor,
  subMetrics,
  decimals = 0,
  className
}) => {
  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} />;
      case 'down':
        return <TrendingDown size={14} />;
      default:
        return <Minus size={14} />;
    }
  };

  return (
    <CardContainer
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      whileHover={{ y: -2, boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.15)' }}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {icon && <CardIcon>{icon}</CardIcon>}
      </CardHeader>
      
      <ValueSection>
        <MainValue>
          <AnimatedCounter 
            value={value} 
            decimals={decimals}
            duration={1000}
          />
        </MainValue>
        {unit && <Unit>{unit}</Unit>}
      </ValueSection>
      
      {change && (
        <ChangeIndicator trend={change.trend} positive={change.positive}>
          {getTrendIcon(change.trend)}
          <ChangeValue>
            {change.value > 0 ? '+' : ''}{change.value.toFixed(1)}
          </ChangeValue>
          <ChangeLabel>{change.label}</ChangeLabel>
        </ChangeIndicator>
      )}
      
      {showProgress && progressPercentage !== undefined && (
        <ProgressBar 
          percentage={progressPercentage} 
          color={progressColor}
        />
      )}
      
      {subMetrics && subMetrics.length > 0 && (
        <SubMetrics>
          {subMetrics.map((metric, index) => (
            <SubMetric key={index}>
              <div className="label">{metric.label}</div>
              <div className="value">{metric.value}</div>
            </SubMetric>
          ))}
        </SubMetrics>
      )}
    </CardContainer>
  );
};