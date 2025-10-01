import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Search, 
  FileText, 
  Settings, 
  Menu, 
  X,
  Heart,
  Zap
} from 'lucide-react';

const NavContainer = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e7eb;
`;

const NavContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  
  @media (max-width: 768px) {
    padding: 0 1rem;
  }
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  text-decoration: none;
  
  &:hover {
    text-decoration: none;
  }
`;

const LogoIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 10px;
  color: white;
`;

const LogoText = styled.span`
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  
  .main {
    font-size: 1.25rem;
    font-weight: 700;
  }
  
  .sub {
    font-size: 0.75rem;
    font-weight: 400;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  @media (max-width: 640px) {
    display: none;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const NavLink = styled(Link)<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.active ? '#3b82f6' : '#64748b'};
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    color: #3b82f6;
    background: #f1f5f9;
    text-decoration: none;
  }
  
  ${props => props.active && `
    background: #eff6ff;
    color: #3b82f6;
  `}
`;

const StatusIndicator = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: ${props => props.connected ? '#dcfce7' : '#fef2f2'};
  color: ${props => props.connected ? '#166534' : '#991b1b'};
  font-size: 0.75rem;
  font-weight: 500;
`;

const StatusDot = styled.div<{ connected: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${props => props.connected ? '#16a34a' : '#dc2626'};
`;

const MobileMenuButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  
  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
  
  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileMenu = styled(motion.div)`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  display: none;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileNavLink = styled(Link)<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.active ? '#3b82f6' : '#64748b'};
  text-decoration: none;
  margin-bottom: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    color: #3b82f6;
    background: #f1f5f9;
    text-decoration: none;
  }
  
  ${props => props.active && `
    background: #eff6ff;
    color: #3b82f6;
  `}
`;

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Activity },
  { path: '/query', label: 'Clinical Query', icon: Search },
  { path: '/papers', label: 'Recent Papers', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface NavbarProps {
  isConnected?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isConnected = false }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <NavContainer>
      <NavContent>
        <Logo to="/dashboard">
          <LogoIcon>
            <Heart size={24} />
          </LogoIcon>
          <LogoText>
            <span className="main">CDSS</span>
            <span className="sub">Clinical Decision Support</span>
          </LogoText>
        </Logo>

        <NavLinks>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                active={location.pathname === item.path}
              >
                <IconComponent size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </NavLinks>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <StatusIndicator connected={isConnected}>
            <StatusDot connected={isConnected} />
            <Zap size={12} />
            {isConnected ? 'Live' : 'Offline'}
          </StatusIndicator>

          <MobileMenuButton onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </MobileMenuButton>
        </div>
      </NavContent>

      {isMobileMenuOpen && (
        <MobileMenu
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <MobileNavLink
                key={item.path}
                to={item.path}
                active={location.pathname === item.path}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <IconComponent size={18} />
                {item.label}
              </MobileNavLink>
            );
          })}
          
          <div style={{ marginTop: '1rem', padding: '0 1rem' }}>
            <StatusIndicator connected={isConnected}>
              <StatusDot connected={isConnected} />
              <Zap size={12} />
              Connection: {isConnected ? 'Connected' : 'Disconnected'}
            </StatusIndicator>
          </div>
        </MobileMenu>
      )}
    </NavContainer>
  );
};

export default Navbar;