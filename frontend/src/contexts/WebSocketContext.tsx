import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface WebSocketMessage {
  type: string;
  message?: string;
  data?: any;
  step?: string;
  response?: any;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  lastMessage: WebSocketMessage | null;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create WebSocket connection
    const newSocket = io(`ws://localhost:8000/ws/${clientId}`, {
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 5000,
      retries: 3,
      retryDelayMax: 10000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      toast.success('Connected to clinical assistant');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      if (reason !== 'io client disconnect') {
        setConnectionError(`Connection lost: ${reason}`);
        toast.error('Connection to clinical assistant lost');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(`Connection error: ${error.message}`);
      toast.error('Failed to connect to clinical assistant');
    });

    // Message handler
    newSocket.on('message', (data: WebSocketMessage) => {
      console.log('Received WebSocket message:', data);
      setLastMessage(data);
      
      // Handle different message types
      switch (data.type) {
        case 'status':
          if (data.message) {
            toast.loading(data.message, { id: 'processing' });
          }
          break;
        
        case 'processing_step':
          if (data.message) {
            toast.loading(data.message, { id: 'processing' });
          }
          break;
        
        case 'clinical_response':
          toast.dismiss('processing');
          toast.success('Clinical recommendations generated');
          break;
        
        case 'error':
          toast.dismiss('processing');
          toast.error(data.message || 'An error occurred');
          break;
        
        default:
          console.log('Unknown message type:', data.type);
      }
    });

    // Reconnection handling
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionError(null);
      toast.success('Reconnected to clinical assistant');
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      setConnectionError(`Reconnection failed: ${error.message}`);
    });

    setSocket(newSocket);

    // Cleanup on component unmount
    return () => {
      toast.dismiss('processing');
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = (message: any) => {
    if (socket && isConnected) {
      socket.emit('message', message);
    } else {
      toast.error('Not connected to clinical assistant');
    }
  };

  const value: WebSocketContextType = {
    socket,
    isConnected,
    sendMessage,
    lastMessage,
    connectionError,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};