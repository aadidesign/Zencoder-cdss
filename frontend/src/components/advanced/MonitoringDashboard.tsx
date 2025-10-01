import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar
} from 'recharts';
import {
  Activity, Server, Database, Cpu, HardDrive, MemoryStick, Network,
  AlertTriangle, CheckCircle, XCircle, Clock, Users, FileText,
  TrendingUp, TrendingDown, Zap, Shield, Target, Brain,
  Heart, Stethoscope, BookOpen, Search, Filter, Download,
  RefreshCw, Settings, Maximize2, Minimize2, Eye, EyeOff,
  Bell, BellOff, Calendar, BarChart3, PieChart as PieChartIcon,
  LineChart as LineChartIcon, Activity as ActivityIcon
} from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { format, subHours, subDays, subMinutes } from 'date-fns';
import { useInterval } from 'react-use';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { StatusIndicator } from '../ui/StatusIndicator';
import { MetricCard } from '../ui/MetricCard';
import { AlertPanel } from '../ui/AlertPanel';
import "react-datepicker/dist/react-datepicker.css";

const DashboardContainer = styled.div`
  padding: 2rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  min-height: 100vh;
`;

const DashboardHeader = styled(motion.div)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
`;

const ControlPanel = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const ControlButton = styled(motion.button)<{ active?: boolean }>`
  padding: 0.5rem 1rem;
  border: 1px solid ${props => props.active ? '#3b82f6' : '#e2e8f0'};
  background: ${props => props.active ? '#3b82f6' : 'white'};
  color: ${props => props.active ? 'white' : '#64748b'};
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3b82f6;
    color: ${props => props.active ? 'white' : '#3b82f6'};
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const MetricCardStyled = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  
  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    
    h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: #64748b;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
  
  .metric-value {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    
    .value {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
    }
    
    .unit {
      font-size: 0.875rem;
      color: #64748b;
    }
  }
  
  .metric-change {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    
    &.positive {
      color: #10b981;
    }
    
    &.negative {
      color: #ef4444;
    }
    
    &.neutral {
      color: #64748b;
    }
  }
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartContainer = styled(motion.div)<{ fullWidth?: boolean }>`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  grid-column: ${props => props.fullWidth ? '1 / -1' : 'auto'};
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    
    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .chart-controls {
      display: flex;
      gap: 0.5rem;
    }
  }
`;

const AlertsContainer = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
`;

const AlertItem = styled(motion.div)<{ severity: 'low' | 'medium' | 'high' | 'critical' }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  border-left: 4px solid ${props => 
    props.severity === 'critical' ? '#dc2626' :
    props.severity === 'high' ? '#ea580c' :
    props.severity === 'medium' ? '#d97706' :
    '#10b981'
  };
  background: ${props => 
    props.severity === 'critical' ? '#fef2f2' :
    props.severity === 'high' ? '#fff7ed' :
    props.severity === 'medium' ? '#fffbeb' :
    '#f0fdf4'
  };
  
  .alert-icon {
    color: ${props => 
      props.severity === 'critical' ? '#dc2626' :
      props.severity === 'high' ? '#ea580c' :
      props.severity === 'medium' ? '#d97706' :
      '#10b981'
    };
  }
  
  .alert-content {
    flex: 1;
    
    h4 {
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.25rem 0;
    }
    
    p {
      color: #6b7280;
      margin: 0;
      font-size: 0.875rem;
    }
    
    .alert-time {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.25rem;
    }
  }
`;

const SystemStatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const ServiceStatusCard = styled(motion.div)<{ status: 'healthy' | 'warning' | 'error' }>`
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => 
    props.status === 'healthy' ? '#10b981' :
    props.status === 'warning' ? '#f59e0b' :
    '#ef4444'
  };
  
  .service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    
    h4 {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin: 0;
    }
  }
  
  .service-metrics {
    font-size: 0.75rem;
    color: #6b7280;
    
    div {
      margin-bottom: 0.25rem;
    }
  }
`;

interface SystemMetrics {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
  responseTime: number;
  activeUsers: number;
  queriesPerMinute: number;
  errorRate: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  responseTime: number;
  lastCheck: Date;
  version: string;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
  component: string;
}

const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'API Gateway',
      status: 'healthy',
      uptime: 99.9,
      responseTime: 45,
      lastCheck: new Date(),
      version: '1.0.0'
    },
    {
      name: 'RAG Service',
      status: 'healthy',
      uptime: 98.5,
      responseTime: 1200,
      lastCheck: new Date(),
      version: '1.2.1'
    },
    {
      name: 'Vector DB',
      status: 'warning',
      uptime: 97.8,
      responseTime: 89,
      lastCheck: new Date(),
      version: '0.4.20'
    },
    {
      name: 'PubMed Service',
      status: 'healthy',
      uptime: 99.1,
      responseTime: 234,
      lastCheck: new Date(),
      version: '2.1.3'
    },
    {
      name: 'WebSocket',
      status: 'healthy',
      uptime: 99.7,
      responseTime: 12,
      lastCheck: new Date(),
      version: '12.0'
    },
    {
      name: 'Redis Cache',
      status: 'healthy',
      uptime: 99.9,
      responseTime: 2,
      lastCheck: new Date(),
      version: '7.0'
    }
  ]);
  
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      title: 'High Response Time',
      message: 'RAG Service response time above threshold (1.2s > 1.0s)',
      severity: 'medium',
      timestamp: subMinutes(new Date(), 15),
      acknowledged: false,
      component: 'RAG Service'
    },
    {
      id: '2',
      title: 'Vector DB Warning',
      message: 'Vector database connection pool at 85% capacity',
      severity: 'medium',
      timestamp: subMinutes(new Date(), 32),
      acknowledged: false,
      component: 'Vector DB'
    }
  ]);

  const [timeRange, setTimeRange] = useState('1h');
  const [selectedMetrics, setSelectedMetrics] = useState(['cpu', 'memory', 'responseTime']);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [selectedChart, setSelectedChart] = useState<'line' | 'area' | 'bar'>('line');
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set());

  const { socket, isConnected } = useWebSocket();

  // Generate mock data
  const generateMockMetrics = useCallback(() => {
    const now = new Date();
    const newMetric: SystemMetrics = {
      timestamp: now,
      cpu: Math.random() * 30 + 30,
      memory: Math.random() * 20 + 60,
      disk: Math.random() * 10 + 75,
      network: {
        in: Math.random() * 1000 + 500,
        out: Math.random() * 800 + 300
      },
      responseTime: Math.random() * 500 + 200,
      activeUsers: Math.floor(Math.random() * 50 + 100),
      queriesPerMinute: Math.floor(Math.random() * 20 + 30),
      errorRate: Math.random() * 2
    };

    setMetrics(prev => {
      const newMetrics = [...prev, newMetric];
      // Keep only last 100 data points
      return newMetrics.slice(-100);
    });
  }, []);

  // Auto refresh
  useInterval(
    generateMockMetrics,
    autoRefresh ? 5000 : null
  );

  // Initialize with some data
  useEffect(() => {
    const initialData = Array.from({ length: 20 }, (_, i) => ({
      timestamp: subMinutes(new Date(), 20 - i),
      cpu: Math.random() * 30 + 30,
      memory: Math.random() * 20 + 60,
      disk: Math.random() * 10 + 75,
      network: {
        in: Math.random() * 1000 + 500,
        out: Math.random() * 800 + 300
      },
      responseTime: Math.random() * 500 + 200,
      activeUsers: Math.floor(Math.random() * 50 + 100),
      queriesPerMinute: Math.floor(Math.random() * 20 + 30),
      errorRate: Math.random() * 2
    }));
    
    setMetrics(initialData);
  }, []);

  // Filtered metrics based on time range
  const filteredMetrics = useMemo(() => {
    const now = new Date();
    const cutoff = timeRange === '1h' ? subHours(now, 1) :
                   timeRange === '6h' ? subHours(now, 6) :
                   timeRange === '24h' ? subHours(now, 24) :
                   subDays(now, 7);
    
    return metrics.filter(m => m.timestamp >= cutoff);
  }, [metrics, timeRange]);

  // Current metrics for display
  const currentMetrics = metrics[metrics.length - 1] || {
    cpu: 0,
    memory: 0,
    disk: 0,
    network: { in: 0, out: 0 },
    responseTime: 0,
    activeUsers: 0,
    queriesPerMinute: 0,
    errorRate: 0
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const toggleChartExpanded = (chartId: string) => {
    setExpandedCharts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chartId)) {
        newSet.delete(chartId);
      } else {
        newSet.add(chartId);
      }
      return newSet;
    });
  };

  const chartData = filteredMetrics.map(metric => ({
    time: format(metric.timestamp, 'HH:mm'),
    cpu: metric.cpu,
    memory: metric.memory,
    responseTime: metric.responseTime / 10, // Scale down for better visualization
    errorRate: metric.errorRate * 10, // Scale up for visibility
    queriesPerMinute: metric.queriesPerMinute,
    activeUsers: metric.activeUsers / 10 // Scale down
  }));

  const pieChartData = [
    { name: 'Healthy', value: services.filter(s => s.status === 'healthy').length, color: '#10b981' },
    { name: 'Warning', value: services.filter(s => s.status === 'warning').length, color: '#f59e0b' },
    { name: 'Error', value: services.filter(s => s.status === 'error').length, color: '#ef4444' }
  ];

  return (
    <DashboardContainer>
      <DashboardHeader
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>
          <BarChart3 size={32} />
          System Monitoring Dashboard
        </h1>
        
        <ControlPanel>
          <Select
            value={{ value: timeRange, label: timeRange }}
            onChange={(option) => setTimeRange(option?.value || '1h')}
            options={[
              { value: '1h', label: 'Last Hour' },
              { value: '6h', label: 'Last 6 Hours' },
              { value: '24h', label: 'Last 24 Hours' },
              { value: '7d', label: 'Last 7 Days' }
            ]}
            styles={{
              control: (base) => ({
                ...base,
                minWidth: '120px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              })
            }}
          />
          
          <ControlButton
            active={autoRefresh}
            onClick={() => setAutoRefresh(!autoRefresh)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw size={16} />
            Auto Refresh
          </ControlButton>
          
          <ControlButton
            active={alertsEnabled}
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {alertsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            Alerts
          </ControlButton>
          
          <ControlButton
            onClick={() => window.print()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={16} />
            Export
          </ControlButton>
        </ControlPanel>
      </DashboardHeader>

      {/* Real-time Metrics Cards */}
      <MetricsGrid>
        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="metric-header">
            <h3>CPU Usage</h3>
            <Cpu size={20} color="#3b82f6" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.cpu} decimals={1} />
            <span className="unit">%</span>
          </div>
          <div className={`metric-change ${currentMetrics.cpu > 70 ? 'negative' : 'positive'}`}>
            {currentMetrics.cpu > 70 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {currentMetrics.cpu > 70 ? 'High usage' : 'Normal'}
          </div>
        </MetricCardStyled>

        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="metric-header">
            <h3>Memory Usage</h3>
            <MemoryStick size={20} color="#10b981" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.memory} decimals={1} />
            <span className="unit">%</span>
          </div>
          <div className={`metric-change ${currentMetrics.memory > 80 ? 'negative' : 'positive'}`}>
            {currentMetrics.memory > 80 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {currentMetrics.memory > 80 ? 'High usage' : 'Normal'}
          </div>
        </MetricCardStyled>

        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="metric-header">
            <h3>Response Time</h3>
            <Clock size={20} color="#f59e0b" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.responseTime} decimals={0} />
            <span className="unit">ms</span>
          </div>
          <div className={`metric-change ${currentMetrics.responseTime > 1000 ? 'negative' : 'positive'}`}>
            {currentMetrics.responseTime > 1000 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {currentMetrics.responseTime > 1000 ? 'Slow' : 'Fast'}
          </div>
        </MetricCardStyled>

        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="metric-header">
            <h3>Active Users</h3>
            <Users size={20} color="#8b5cf6" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.activeUsers} decimals={0} />
            <span className="unit">users</span>
          </div>
          <div className="metric-change positive">
            <TrendingUp size={14} />
            Active sessions
          </div>
        </MetricCardStyled>

        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="metric-header">
            <h3>Queries/Min</h3>
            <Search size={20} color="#06b6d4" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.queriesPerMinute} decimals={0} />
            <span className="unit">qpm</span>
          </div>
          <div className="metric-change positive">
            <Activity size={14} />
            Processing
          </div>
        </MetricCardStyled>

        <MetricCardStyled
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className="metric-header">
            <h3>Error Rate</h3>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div className="metric-value">
            <AnimatedCounter className="value" value={currentMetrics.errorRate} decimals={2} />
            <span className="unit">%</span>
          </div>
          <div className={`metric-change ${currentMetrics.errorRate > 1 ? 'negative' : 'positive'}`}>
            {currentMetrics.errorRate > 1 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {currentMetrics.errorRate > 1 ? 'High errors' : 'Low errors'}
          </div>
        </MetricCardStyled>
      </MetricsGrid>

      {/* Service Status Grid */}
      <SystemStatusGrid>
        {services.map((service, index) => (
          <ServiceStatusCard
            key={service.name}
            status={service.status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
          >
            <div className="service-header">
              <h4>{service.name}</h4>
              <StatusIndicator 
                status={service.status} 
                size="small"
                icon={service.status === 'healthy' ? CheckCircle : 
                      service.status === 'warning' ? AlertTriangle : XCircle}
              />
            </div>
            <div className="service-metrics">
              <div>Uptime: {service.uptime}%</div>
              <div>Response: {service.responseTime}ms</div>
              <div>Version: {service.version}</div>
            </div>
          </ServiceStatusCard>
        ))}
      </SystemStatusGrid>

      {/* Alerts Panel */}
      <AnimatePresence>
        {alertsEnabled && alerts.filter(a => !a.acknowledged).length > 0 && (
          <AlertsContainer
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} />
                Active Alerts ({alerts.filter(a => !a.acknowledged).length})
              </h3>
              <ControlButton onClick={() => setAlertsEnabled(false)}>
                <EyeOff size={16} />
                Hide
              </ControlButton>
            </div>
            
            {alerts.filter(a => !a.acknowledged).map((alert, index) => (
              <AlertItem
                key={alert.id}
                severity={alert.severity}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className="alert-icon">
                  {alert.severity === 'critical' ? <XCircle size={20} /> :
                   alert.severity === 'high' ? <AlertTriangle size={20} /> :
                   alert.severity === 'medium' ? <AlertTriangle size={20} /> :
                   <CheckCircle size={20} />}
                </div>
                
                <div className="alert-content">
                  <h4>{alert.title}</h4>
                  <p>{alert.message}</p>
                  <div className="alert-time">
                    {format(alert.timestamp, 'MMM dd, HH:mm')} • {alert.component}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <ControlButton onClick={() => handleAcknowledgeAlert(alert.id)}>
                    Acknowledge
                  </ControlButton>
                  <ControlButton onClick={() => handleDismissAlert(alert.id)}>
                    Dismiss
                  </ControlButton>
                </div>
              </AlertItem>
            ))}
          </AlertsContainer>
        )}
      </AnimatePresence>

      {/* Charts Grid */}
      <ChartsGrid>
        {/* System Performance Chart */}
        <ChartContainer
          fullWidth={expandedCharts.has('performance')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="chart-header">
            <h3>
              <LineChartIcon size={20} />
              System Performance
            </h3>
            <div className="chart-controls">
              <Select
                value={{ value: selectedChart, label: selectedChart }}
                onChange={(option) => setSelectedChart(option?.value as any || 'line')}
                options={[
                  { value: 'line', label: 'Line' },
                  { value: 'area', label: 'Area' },
                  { value: 'bar', label: 'Bar' }
                ]}
                styles={{
                  control: (base) => ({
                    ...base,
                    minWidth: '100px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px'
                  })
                }}
              />
              <ControlButton onClick={() => toggleChartExpanded('performance')}>
                {expandedCharts.has('performance') ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </ControlButton>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={expandedCharts.has('performance') ? 600 : 300}>
            {selectedChart === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memory" stroke="#10b981" name="Memory %" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="responseTime" stroke="#f59e0b" name="Response Time (10ms)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : selectedChart === 'area' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="memory" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Bar dataKey="cpu" fill="#3b82f6" name="CPU %" />
                <Bar dataKey="memory" fill="#10b981" name="Memory %" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartContainer>

        {/* Service Status Distribution */}
        <ChartContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="chart-header">
            <h3>
              <PieChartIcon size={20} />
              Service Health
            </h3>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Query Volume Chart */}
        <ChartContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="chart-header">
            <h3>
              <ActivityIcon size={20} />
              Query Activity
            </h3>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="queriesPerMinute" 
                stroke="#8b5cf6" 
                fill="#8b5cf6" 
                fillOpacity={0.3}
                name="Queries/min"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Error Rate Chart */}
        <ChartContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="chart-header">
            <h3>
              <AlertTriangle size={20} />
              Error Rate
            </h3>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="errorRate" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                name="Error Rate %"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ChartsGrid>
    </DashboardContainer>
  );
};

export default MonitoringDashboard;