import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Database, 
  Zap, 
  Shield,
  Globe,
  Bell,
  Save,
  RefreshCw,
  Info
} from 'lucide-react';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
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
`;

const SettingsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const SettingsSection = styled(Card)`
  padding: 2rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
`;

const SectionDescription = styled.p`
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 2rem;
  line-height: 1.6;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  
  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Checkbox = styled.input`
  margin-right: 0.5rem;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  margin-bottom: 1rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const HelpText = styled.div`
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  flex-wrap: wrap;
`;

const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #eff6ff;
  border: 1px solid #3b82f6;
  border-radius: 8px;
  margin-bottom: 1.5rem;
`;

const InfoContent = styled.div`
  color: #1e40af;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    // API Settings
    pubmedApiKey: '',
    pubmedEmail: 'your-email@example.com',
    
    // Model Settings
    maxSearchResults: 10,
    similarityThreshold: 0.7,
    
    // Real-time Settings
    pubmedFetchLimit: 20,
    cacheTimeout: 3600,
    
    // UI Settings
    enableNotifications: true,
    enableRealTimeUpdates: true,
    darkMode: false,
    
    // Security Settings
    enableLogging: true,
    anonymizeData: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (key: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real app, you would send settings to the backend
    console.log('Saving settings:', settings);
    
    setIsSaving(false);
    // Show success toast
  };

  const handleReset = () => {
    setSettings({
      pubmedApiKey: '',
      pubmedEmail: 'your-email@example.com',
      maxSearchResults: 10,
      similarityThreshold: 0.7,
      pubmedFetchLimit: 20,
      cacheTimeout: 3600,
      enableNotifications: true,
      enableRealTimeUpdates: true,
      darkMode: false,
      enableLogging: true,
      anonymizeData: true,
    });
  };

  return (
    <Container>
      <Header>
        <Title>Settings</Title>
        <Subtitle>Configure your Clinical Decision Support System</Subtitle>
      </Header>

      <SettingsGrid>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SettingsSection>
            <SectionHeader>
              <Globe size={24} color="#3b82f6" />
              <SectionTitle>API Configuration</SectionTitle>
            </SectionHeader>
            <SectionDescription>
              Configure external API connections for PubMed and other medical databases.
            </SectionDescription>

            <InfoBox>
              <Info size={16} />
              <InfoContent>
                PubMed API key is optional but recommended for higher rate limits. 
                You can obtain one from the NCBI website.
              </InfoContent>
            </InfoBox>

            <FormGroup>
              <Label htmlFor="pubmedEmail">PubMed Email (Required)</Label>
              <Input
                id="pubmedEmail"
                type="email"
                value={settings.pubmedEmail}
                onChange={(e) => handleInputChange('pubmedEmail', e.target.value)}
                placeholder="your-email@example.com"
              />
              <HelpText>
                Required by NCBI for API access identification
              </HelpText>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="pubmedApiKey">PubMed API Key (Optional)</Label>
              <Input
                id="pubmedApiKey"
                type="password"
                value={settings.pubmedApiKey}
                onChange={(e) => handleInputChange('pubmedApiKey', e.target.value)}
                placeholder="Enter your PubMed API key"
              />
              <HelpText>
                Increases rate limits from 3 to 10 requests per second
              </HelpText>
            </FormGroup>
          </SettingsSection>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <SettingsSection>
            <SectionHeader>
              <Database size={24} color="#10b981" />
              <SectionTitle>Model & Search Configuration</SectionTitle>
            </SectionHeader>
            <SectionDescription>
              Adjust AI model parameters and search behavior for optimal results.
            </SectionDescription>

            <FormGroup>
              <Label htmlFor="maxSearchResults">Maximum Search Results</Label>
              <Select
                id="maxSearchResults"
                value={settings.maxSearchResults}
                onChange={(e) => handleInputChange('maxSearchResults', parseInt(e.target.value))}
              >
                <option value={5}>5 results</option>
                <option value={10}>10 results</option>
                <option value={15}>15 results</option>
                <option value={20}>20 results</option>
                <option value={30}>30 results</option>
              </Select>
              <HelpText>
                Number of relevant papers to retrieve for each query
              </HelpText>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="similarityThreshold">Similarity Threshold</Label>
              <Select
                id="similarityThreshold"
                value={settings.similarityThreshold}
                onChange={(e) => handleInputChange('similarityThreshold', parseFloat(e.target.value))}
              >
                <option value={0.5}>0.5 (More results, lower precision)</option>
                <option value={0.6}>0.6 (Balanced)</option>
                <option value={0.7}>0.7 (Recommended)</option>
                <option value={0.8}>0.8 (Higher precision, fewer results)</option>
                <option value={0.9}>0.9 (Very high precision)</option>
              </Select>
              <HelpText>
                Minimum similarity score for including papers in results
              </HelpText>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="pubmedFetchLimit">PubMed Fetch Limit</Label>
              <Select
                id="pubmedFetchLimit"
                value={settings.pubmedFetchLimit}
                onChange={(e) => handleInputChange('pubmedFetchLimit', parseInt(e.target.value))}
              >
                <option value={10}>10 papers per query</option>
                <option value={20}>20 papers per query</option>
                <option value={50}>50 papers per query</option>
                <option value={100}>100 papers per query</option>
              </Select>
              <HelpText>
                Number of recent papers to fetch from PubMed for each query
              </HelpText>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="cacheTimeout">Cache Timeout (seconds)</Label>
              <Select
                id="cacheTimeout"
                value={settings.cacheTimeout}
                onChange={(e) => handleInputChange('cacheTimeout', parseInt(e.target.value))}
              >
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={7200}>2 hours</option>
                <option value={21600}>6 hours</option>
                <option value={86400}>24 hours</option>
              </Select>
              <HelpText>
                How long to cache search results before refreshing
              </HelpText>
            </FormGroup>
          </SettingsSection>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <SettingsSection>
            <SectionHeader>
              <Zap size={24} color="#f59e0b" />
              <SectionTitle>Real-time & UI Settings</SectionTitle>
            </SectionHeader>
            <SectionDescription>
              Configure real-time updates and user interface preferences.
            </SectionDescription>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                />
                Enable browser notifications
              </CheckboxLabel>
              <HelpText>
                Get notified when query processing is complete
              </HelpText>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={settings.enableRealTimeUpdates}
                  onChange={(e) => handleInputChange('enableRealTimeUpdates', e.target.checked)}
                />
                Enable real-time processing updates
              </CheckboxLabel>
              <HelpText>
                Show live updates during query processing via WebSocket
              </HelpText>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => handleInputChange('darkMode', e.target.checked)}
                />
                Dark mode (Coming soon)
              </CheckboxLabel>
              <HelpText>
                Enable dark theme for better viewing in low light
              </HelpText>
            </FormGroup>
          </SettingsSection>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <SettingsSection>
            <SectionHeader>
              <Shield size={24} color="#ef4444" />
              <SectionTitle>Privacy & Security</SectionTitle>
            </SectionHeader>
            <SectionDescription>
              Configure privacy settings and data handling preferences.
            </SectionDescription>

            <InfoBox>
              <Info size={16} />
              <InfoContent>
                This system handles medical information. All data is processed locally 
                and no patient information is shared with third parties.
              </InfoContent>
            </InfoBox>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={settings.enableLogging}
                  onChange={(e) => handleInputChange('enableLogging', e.target.checked)}
                />
                Enable system logging
              </CheckboxLabel>
              <HelpText>
                Log system events for troubleshooting (no patient data logged)
              </HelpText>
            </FormGroup>

            <FormGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={settings.anonymizeData}
                  onChange={(e) => handleInputChange('anonymizeData', e.target.checked)}
                />
                Anonymize patient data
              </CheckboxLabel>
              <HelpText>
                Remove identifying information from processed data
              </HelpText>
            </FormGroup>
          </SettingsSection>
        </motion.div>
      </SettingsGrid>

      <ButtonGroup>
        <Button
          variant="outline"
          onClick={handleReset}
          icon={<RefreshCw />}
        >
          Reset to Defaults
        </Button>
        
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSaving}
          icon={<Save />}
        >
          Save Settings
        </Button>
      </ButtonGroup>
    </Container>
  );
};

export default Settings;