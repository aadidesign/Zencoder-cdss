import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Search, 
  FileText, 
  Database, 
  Clock,
  TrendingUp,
  Users,
  AlertCircle,
  ArrowRight,
  Zap
} from 'lucide-react';
import axios from 'axios';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useWebSocket } from '../contexts/WebSocketContext';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    rag_service: {
      initialized: boolean;
      pubmed_service: boolean;
      vector_db: boolean;
      clinical_processor: boolean;
      models_loaded: boolean;
    };
    websocket_manager: {
      active_connections: number;
      service_available: boolean;
    };
    vector_db_stats?: {
      total_documents: number;
      collection_name: string;
    };
  };
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 3rem;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const StatCard = styled(Card)`
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const StatIcon = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.color}20;
  color: ${props => props.color};
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const StatTrend = styled.div<{ positive: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: ${props => props.positive ? '#10b981' : '#ef4444'};
  margin-top: 0.5rem;
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const ActionCard = styled(Card)`
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border-color: #3b82f6;
  }
`;

const ActionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  margin: 0 auto 1.5rem auto;
`;

const ActionTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
`;

const ActionDescription = styled.p`
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 1.5rem;
`;

const SystemStatusSection = styled.div`
  margin-bottom: 3rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

const StatusItem = styled(Card)<{ status: 'healthy' | 'warning' | 'error' }>`
  padding: 1.25rem;
  border-left: 4px solid ${props => 
    props.status === 'healthy' ? '#10b981' :
    props.status === 'warning' ? '#f59e0b' :
    '#ef4444'
  };
`;

const StatusItemTitle = styled.div`
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatusItemValue = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  font-size: 0.875rem;
  color: ${props => 
    props.status === 'healthy' ? '#059669' :
    props.status === 'warning' ? '#d97706' :
    '#dc2626'
  };
  font-weight: 500;
`;

const StatusIndicator = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => 
    props.status === 'healthy' ? '#10b981' :
    props.status === 'warning' ? '#f59e0b' :
    '#ef4444'
  };
`;

const Dashboard: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  const { data: healthData, isLoading, error } = useQuery<HealthStatus>(
    'health-status',
    async () => {
      const response = await axios.get('/api/v1/health/detailed');
      return response.data;
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      onSuccess: () => {
        setLastUpdateTime(new Date());
      }
    }
  );

  const getServiceStatus = (value: boolean | number): 'healthy' | 'warning' | 'error' => {
    if (typeof value === 'boolean') {
      return value ? 'healthy' : 'error';
    }
    return value > 0 ? 'healthy' : 'warning';
  };

  const statsData = [
    {
      icon: Database,
      color: '#3b82f6',
      value: healthData?.services?.vector_db_stats?.total_documents || 0,
      label: 'Research Papers',
      trend: '+12%',
      positive: true,
    },
    {
      icon: Users,
      color: '#10b981',
      value: healthData?.services?.websocket_manager?.active_connections || 0,
      label: 'Active Sessions',
      trend: 'Live',
      positive: true,
    },
    {
      icon: Activity,
      color: '#f59e0b',
      value: healthData?.status === 'healthy' ? 'Online' : 'Offline',
      label: 'System Status',
      trend: healthData?.status === 'healthy' ? 'Operational' : 'Issues',
      positive: healthData?.status === 'healthy',
    },
    {
      icon: Zap,
      color: '#8b5cf6',
      value: isConnected ? 'Connected' : 'Offline',
      label: 'Real-time Connection',
      trend: isConnected ? 'Live' : 'Disconnected',
      positive: isConnected,
    },
  ];

  const actionItems = [
    {
      icon: Search,
      title: 'Clinical Query',
      description: 'Get evidence-based clinical recommendations powered by real-time PubMed research and AI analysis.',
      link: '/query',
    },
    {
      icon: FileText,
      title: 'Recent Papers',
      description: 'Browse the latest medical research papers from PubMed with AI-powered insights and relevance scoring.',
      link: '/papers',
    },
  ];

  if (isLoading) {
    return (
      <Container>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <LoadingSpinner size="large" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Clinical Decision Support System</Title>
        <Subtitle>
          Real-time evidence-based clinical recommendations powered by PubMedBERT and live medical literature
        </Subtitle>
      </Header>

      <StatsGrid>
        {statsData.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <StatCard>
              <StatHeader>
                <div>
                  <StatValue>{stat.value}</StatValue>
                  <StatLabel>{stat.label}</StatLabel>
                  <StatTrend positive={stat.positive}>
                    <TrendingUp size={12} />
                    {stat.trend}
                  </StatTrend>
                </div>
                <StatIcon color={stat.color}>
                  <stat.icon size={24} />
                </StatIcon>
              </StatHeader>
            </StatCard>
          </motion.div>
        ))}
      </StatsGrid>

      <ActionsGrid>
        {actionItems.map((action, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
          >
            <Link to={action.link} style={{ textDecoration: 'none' }}>
              <ActionCard>
                <ActionIcon>
                  <action.icon size={28} />
                </ActionIcon>
                <ActionTitle>{action.title}</ActionTitle>
                <ActionDescription>{action.description}</ActionDescription>
                <Button variant="outline" icon={<ArrowRight />}>
                  Get Started
                </Button>
              </ActionCard>
            </Link>
          </motion.div>
        ))}
      </ActionsGrid>

      <SystemStatusSection>
        <SectionTitle>
          <Activity />
          System Status
        </SectionTitle>

        {error ? (
          <Card padding="large">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              color: '#ef4444' 
            }}>
              <AlertCircle />
              <div>
                <div style={{ fontWeight: '600' }}>Unable to fetch system status</div>
                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Please check your connection and try again.
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <StatusGrid>
            <StatusItem status={getServiceStatus(healthData?.services?.rag_service?.initialized || false)}>
              <StatusItemTitle>
                RAG Service
                <StatusIndicator status={getServiceStatus(healthData?.services?.rag_service?.initialized || false)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(healthData?.services?.rag_service?.initialized || false)}>
                {healthData?.services?.rag_service?.initialized ? 'Initialized' : 'Not Ready'}
              </StatusItemValue>
            </StatusItem>

            <StatusItem status={getServiceStatus(healthData?.services?.rag_service?.models_loaded || false)}>
              <StatusItemTitle>
                AI Models
                <StatusIndicator status={getServiceStatus(healthData?.services?.rag_service?.models_loaded || false)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(healthData?.services?.rag_service?.models_loaded || false)}>
                {healthData?.services?.rag_service?.models_loaded ? 'Loaded' : 'Loading'}
              </StatusItemValue>
            </StatusItem>

            <StatusItem status={getServiceStatus(healthData?.services?.rag_service?.vector_db || false)}>
              <StatusItemTitle>
                Vector Database
                <StatusIndicator status={getServiceStatus(healthData?.services?.rag_service?.vector_db || false)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(healthData?.services?.rag_service?.vector_db || false)}>
                {healthData?.services?.rag_service?.vector_db ? 'Connected' : 'Disconnected'}
              </StatusItemValue>
            </StatusItem>

            <StatusItem status={getServiceStatus(healthData?.services?.rag_service?.pubmed_service || false)}>
              <StatusItemTitle>
                PubMed Service
                <StatusIndicator status={getServiceStatus(healthData?.services?.rag_service?.pubmed_service || false)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(healthData?.services?.rag_service?.pubmed_service || false)}>
                {healthData?.services?.rag_service?.pubmed_service ? 'Available' : 'Unavailable'}
              </StatusItemValue>
            </StatusItem>

            <StatusItem status={getServiceStatus(isConnected)}>
              <StatusItemTitle>
                WebSocket
                <StatusIndicator status={getServiceStatus(isConnected)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(isConnected)}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </StatusItemValue>
            </StatusItem>

            <StatusItem status={getServiceStatus(healthData?.services?.websocket_manager?.active_connections || 0)}>
              <StatusItemTitle>
                Active Connections
                <StatusIndicator status={getServiceStatus(healthData?.services?.websocket_manager?.active_connections || 0)} />
              </StatusItemTitle>
              <StatusItemValue status={getServiceStatus(healthData?.services?.websocket_manager?.active_connections || 0)}>
                {healthData?.services?.websocket_manager?.active_connections || 0}
              </StatusItemValue>
            </StatusItem>
          </StatusGrid>
        )}

        <div style={{ 
          marginTop: '1rem', 
          fontSize: '0.875rem', 
          color: '#6b7280', 
          textAlign: 'center' 
        }}>
          Last updated: {lastUpdateTime.toLocaleTimeString()}
        </div>
      </SystemStatusSection>
    </Container>
  );
};

export default Dashboard;