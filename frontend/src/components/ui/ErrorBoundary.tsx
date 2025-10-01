import React, { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
  text-align: center;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin: 2rem auto;
  max-width: 600px;
`;

const ErrorIcon = styled.div`
  color: #ef4444;
  margin-bottom: 1rem;
`;

const ErrorTitle = styled.h2`
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const ErrorMessage = styled.p`
  color: #64748b;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  max-width: 400px;
`;

const ErrorDetails = styled.details`
  margin: 1rem 0;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  max-width: 100%;
  width: 500px;
  
  summary {
    cursor: pointer;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
    
    &:hover {
      color: #1e293b;
    }
  }
  
  pre {
    font-size: 0.75rem;
    color: #64748b;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
`;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorIcon>
            <AlertTriangle size={64} />
          </ErrorIcon>
          
          <ErrorTitle>Something went wrong</ErrorTitle>
          
          <ErrorMessage>
            The Clinical Decision Support System encountered an unexpected error. 
            Please try refreshing the page or contact support if the problem persists.
          </ErrorMessage>

          {this.state.error && (
            <ErrorDetails>
              <summary>Error Details</summary>
              <pre>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </ErrorDetails>
          )}

          <ButtonGroup>
            <Button
              onClick={this.handleReset}
              variant="outline"
              icon={<RefreshCw />}
            >
              Try Again
            </Button>
            
            <Button
              onClick={this.handleReload}
              variant="primary"
              icon={<RefreshCw />}
            >
              Reload Page
            </Button>
          </ButtonGroup>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;