import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Info,
  X,
  Clock,
  User,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

const AlertContainer = styled(motion.div)<{ severity: 'info' | 'warning' | 'error' | 'critical' }>`
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-left: 4px solid ${props => 
    props.severity === 'critical' ? '#dc2626' :
    props.severity === 'error' ? '#ef4444' :
    props.severity === 'warning' ? '#f59e0b' :
    '#3b82f6'
  };
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const AlertHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const AlertIconContainer = styled.div<{ severity: 'info' | 'warning' | 'error' | 'critical' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => 
    props.severity === 'critical' ? '#fef2f2' :
    props.severity === 'error' ? '#fef2f2' :
    props.severity === 'warning' ? '#fffbeb' :
    '#eff6ff'
  };
  color: ${props => 
    props.severity === 'critical' ? '#dc2626' :
    props.severity === 'error' ? '#ef4444' :
    props.severity === 'warning' ? '#d97706' :
    '#3b82f6'
  };
  flex-shrink: 0;
  margin-right: 0.75rem;
`;

const AlertContent = styled.div`
  flex: 1;
`;

const AlertTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
`;

const AlertMessage = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
`;

const AlertMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: #9ca3af;
  margin-bottom: 0.75rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const AlertActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const ActionButton = styled(motion.button)<{ variant: 'primary' | 'secondary' | 'danger' }>`
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
          
          &:hover {
            background: #2563eb;
            border-color: #2563eb;
          }
        `;
      case 'danger':
        return `
          background: #ef4444;
          color: white;
          border-color: #ef4444;
          
          &:hover {
            background: #dc2626;
            border-color: #dc2626;
          }
        `;
      default:
        return `
          background: white;
          color: #374151;
          border-color: #d1d5db;
          
          &:hover {
            background: #f9fafb;
            border-color: #9ca3af;
          }
        `;
    }
  }}
`;

const DismissButton = styled(motion.button)`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
`;

const PriorityBadge = styled.span<{ priority: 'low' | 'medium' | 'high' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  ${props => {
    switch (props.priority) {
      case 'critical':
        return `
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        `;
      case 'high':
        return `
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
        `;
      case 'medium':
        return `
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        `;
      default:
        return `
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        `;
    }
  }}
`;

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source?: string;
  user?: string;
  location?: string;
  acknowledged?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

interface AlertPanelProps {
  alerts: Alert[];
  onDismiss?: (alertId: string) => void;
  onAcknowledge?: (alertId: string) => void;
  maxHeight?: string;
  showDismissAll?: boolean;
  onDismissAll?: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onDismiss,
  onAcknowledge,
  maxHeight = '400px',
  showDismissAll = false,
  onDismissAll
}) => {
  const getAlertIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return XCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      default:
        return CheckCircle;
    }
  };

  if (alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#6b7280',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <CheckCircle size={32} style={{ marginBottom: '1rem', color: '#10b981' }} />
        <p>No active alerts</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {showDismissAll && alerts.length > 1 && (
        <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
          <ActionButton
            variant="secondary"
            onClick={onDismissAll}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Dismiss All ({alerts.length})
          </ActionButton>
        </div>
      )}
      
      <div style={{ maxHeight, overflowY: 'auto' }}>
        <AnimatePresence>
          {alerts.map((alert, index) => {
            const IconComponent = getAlertIcon(alert.severity);
            
            return (
              <AlertContainer
                key={alert.id}
                severity={alert.severity}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ 
                  duration: 0.2, 
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                layout
              >
                <AlertHeader>
                  <div style={{ display: 'flex', flex: 1 }}>
                    <AlertIconContainer severity={alert.severity}>
                      <IconComponent size={16} />
                    </AlertIconContainer>
                    
                    <AlertContent>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <AlertTitle>{alert.title}</AlertTitle>
                        {alert.priority && (
                          <PriorityBadge priority={alert.priority}>
                            {alert.priority}
                          </PriorityBadge>
                        )}
                      </div>
                      
                      <AlertMessage>{alert.message}</AlertMessage>
                      
                      <AlertMeta>
                        <MetaItem>
                          <Clock size={12} />
                          {format(alert.timestamp, 'MMM dd, HH:mm:ss')}
                        </MetaItem>
                        {alert.source && (
                          <MetaItem>
                            <MapPin size={12} />
                            {alert.source}
                          </MetaItem>
                        )}
                        {alert.user && (
                          <MetaItem>
                            <User size={12} />
                            {alert.user}
                          </MetaItem>
                        )}
                      </AlertMeta>
                      
                      <AlertActions>
                        {alert.actions?.map((action, actionIndex) => (
                          <ActionButton
                            key={actionIndex}
                            variant={action.variant || 'secondary'}
                            onClick={action.action}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {action.label}
                          </ActionButton>
                        ))}
                        
                        {!alert.acknowledged && onAcknowledge && (
                          <ActionButton
                            variant="primary"
                            onClick={() => onAcknowledge(alert.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Acknowledge
                          </ActionButton>
                        )}
                      </AlertActions>
                    </AlertContent>
                  </div>
                  
                  {onDismiss && (
                    <DismissButton
                      onClick={() => onDismiss(alert.id)}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X size={14} />
                    </DismissButton>
                  )}
                </AlertHeader>
              </AlertContainer>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};