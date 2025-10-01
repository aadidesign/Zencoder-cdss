import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, AlertCircle, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

import { useWebSocket } from '../contexts/WebSocketContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

interface PatientContext {
  age?: number;
  gender?: string;
  existing_conditions?: string[];
  current_medications?: string[];
  allergies?: string[];
}

interface ClinicalResponse {
  query: string;
  timestamp: string;
  recommendations: {
    primary_recommendation: string;
    evidence_level: string;
    confidence_score: number;
    supporting_evidence: any[];
    contraindications: string[];
    follow_up_actions: string[];
    evidence_summary: string;
    disclaimer: string;
  };
  sources: Array<{
    pmid: string;
    title: string;
    authors: string[];
    journal: string;
    pub_date: string;
    relevance_score: number;
    url: string;
  }>;
  processing_time: number;
  confidence_score: number;
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 0;
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
  max-width: 600px;
  margin: 0 auto;
`;

const QuerySection = styled(Card)`
  margin-bottom: 2rem;
`;

const QueryForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const QueryInput = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  transition: all 0.2s ease;

  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const PatientContextSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
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

const TagInput = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const Tag = styled.span`
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const RemoveTagButton = styled.button`
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: #ef4444;
  }
`;

const ConnectionStatus = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: ${props => props.connected ? '#dcfce7' : '#fef2f2'};
  color: ${props => props.connected ? '#166534' : '#991b1b'};
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const StatusDot = styled.div<{ connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.connected ? '#16a34a' : '#dc2626'};
`;

const ResponseSection = styled(motion.div)`
  margin-top: 2rem;
`;

const RecommendationCard = styled(Card)`
  margin-bottom: 1.5rem;
`;

const RecommendationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const RecommendationTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
`;

const ConfidenceScore = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ScoreBar = styled.div<{ score: number }>`
  width: 100px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.score * 100}%;
    background: ${props => 
      props.score >= 0.8 ? '#10b981' :
      props.score >= 0.6 ? '#f59e0b' :
      '#ef4444'
    };
    transition: width 0.3s ease;
  }
`;

const RecommendationContent = styled.div`
  line-height: 1.7;
  color: #374151;
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h4`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 1.5rem 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ListItem = styled.li`
  margin-bottom: 0.5rem;
  line-height: 1.6;
`;

const SourcesGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const SourceCard = styled(Card)`
  padding: 1.5rem;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
`;

const SourceTitle = styled.h5`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
  line-height: 1.4;
`;

const SourceMeta = styled.div`
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.75rem;
`;

const RelevanceScore = styled.div<{ score: number }>`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => 
    props.score >= 0.8 ? '#dcfce7' :
    props.score >= 0.6 ? '#fef3c7' :
    '#fee2e2'
  };
  color: ${props => 
    props.score >= 0.8 ? '#166534' :
    props.score >= 0.6 ? '#92400e' :
    '#991b1b'
  };
`;

const DisclaimerBox = styled.div`
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const DisclaimerContent = styled.div`
  color: #92400e;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const ClinicalQuery: React.FC = () => {
  const { isConnected, sendMessage, lastMessage } = useWebSocket();
  const [query, setQuery] = useState('');
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<ClinicalResponse | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  // Tag management for patient context
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'processing_step':
          setCurrentStep(lastMessage.message || '');
          break;
        
        case 'clinical_response':
          setResponse(lastMessage.response);
          setIsProcessing(false);
          setCurrentStep('');
          break;
        
        case 'error':
          setIsProcessing(false);
          setCurrentStep('');
          toast.error(lastMessage.message || 'An error occurred');
          break;
      }
    }
  }, [lastMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Please enter a clinical query');
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to clinical assistant');
      return;
    }

    setIsProcessing(true);
    setResponse(null);
    
    const message = {
      type: 'clinical_query',
      query: query.trim(),
      patient_context: {
        ...patientContext,
        existing_conditions: patientContext.existing_conditions || [],
        current_medications: patientContext.current_medications || [],
        allergies: patientContext.allergies || [],
      },
    };

    sendMessage(message);
  };

  const addTag = (type: 'existing_conditions' | 'current_medications' | 'allergies', value: string) => {
    if (!value.trim()) return;
    
    setPatientContext(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), value.trim()],
    }));

    // Clear input
    if (type === 'existing_conditions') setConditionInput('');
    if (type === 'current_medications') setMedicationInput('');
    if (type === 'allergies') setAllergyInput('');
  };

  const removeTag = (type: 'existing_conditions' | 'current_medications' | 'allergies', index: number) => {
    setPatientContext(prev => ({
      ...prev,
      [type]: prev[type]?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent, type: 'existing_conditions' | 'current_medications' | 'allergies', value: string) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(type, value);
    }
  };

  return (
    <Container>
      <Header>
        <Title>Clinical Decision Support</Title>
        <Subtitle>
          Get evidence-based clinical recommendations powered by real-time PubMed research 
          and PubMedBERT AI analysis
        </Subtitle>
      </Header>

      <ConnectionStatus connected={isConnected}>
        <StatusDot connected={isConnected} />
        {isConnected ? 'Connected to clinical assistant' : 'Disconnected from clinical assistant'}
      </ConnectionStatus>

      <QuerySection>
        <QueryForm onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="query">Clinical Query</Label>
            <QueryInput
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your clinical question or scenario... 

Examples:
• What are the latest treatment options for resistant hypertension in elderly patients?
• Evidence for anticoagulation in atrial fibrillation with low bleeding risk?
• Best practices for managing diabetes in patients with chronic kidney disease?"
              disabled={isProcessing}
            />
          </div>

          <div>
            <Label>Patient Context (Optional)</Label>
            <PatientContextSection>
              <InputGroup>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={patientContext.age || ''}
                  onChange={(e) => setPatientContext(prev => ({
                    ...prev,
                    age: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="Age"
                  disabled={isProcessing}
                />
              </InputGroup>

              <InputGroup>
                <Label htmlFor="gender">Gender</Label>
                <Input
                  id="gender"
                  value={patientContext.gender || ''}
                  onChange={(e) => setPatientContext(prev => ({
                    ...prev,
                    gender: e.target.value
                  }))}
                  placeholder="Gender"
                  disabled={isProcessing}
                />
              </InputGroup>
            </PatientContextSection>

            <PatientContextSection>
              <InputGroup>
                <Label>Existing Conditions</Label>
                <Input
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'existing_conditions', conditionInput)}
                  placeholder="Add condition and press Enter"
                  disabled={isProcessing}
                />
                <TagInput>
                  {patientContext.existing_conditions?.map((condition, index) => (
                    <Tag key={index}>
                      {condition}
                      <RemoveTagButton
                        onClick={() => removeTag('existing_conditions', index)}
                        type="button"
                      >
                        ×
                      </RemoveTagButton>
                    </Tag>
                  ))}
                </TagInput>
              </InputGroup>

              <InputGroup>
                <Label>Current Medications</Label>
                <Input
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'current_medications', medicationInput)}
                  placeholder="Add medication and press Enter"
                  disabled={isProcessing}
                />
                <TagInput>
                  {patientContext.current_medications?.map((medication, index) => (
                    <Tag key={index}>
                      {medication}
                      <RemoveTagButton
                        onClick={() => removeTag('current_medications', index)}
                        type="button"
                      >
                        ×
                      </RemoveTagButton>
                    </Tag>
                  ))}
                </TagInput>
              </InputGroup>

              <InputGroup>
                <Label>Allergies</Label>
                <Input
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'allergies', allergyInput)}
                  placeholder="Add allergy and press Enter"
                  disabled={isProcessing}
                />
                <TagInput>
                  {patientContext.allergies?.map((allergy, index) => (
                    <Tag key={index}>
                      {allergy}
                      <RemoveTagButton
                        onClick={() => removeTag('allergies', index)}
                        type="button"
                      >
                        ×
                      </RemoveTagButton>
                    </Tag>
                  ))}
                </TagInput>
              </InputGroup>
            </PatientContextSection>
          </div>

          <Button
            type="submit"
            disabled={!query.trim() || isProcessing || !isConnected}
            loading={isProcessing}
            icon={<Search />}
          >
            {isProcessing ? 'Processing...' : 'Get Clinical Recommendations'}
          </Button>
        </QueryForm>

        {isProcessing && currentStep && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <LoadingSpinner size="small" />
            <span style={{ color: '#0369a1' }}>{currentStep}</span>
          </motion.div>
        )}
      </QuerySection>

      <AnimatePresence>
        {response && (
          <ResponseSection
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <RecommendationCard>
              <RecommendationHeader>
                <RecommendationTitle>Clinical Recommendations</RecommendationTitle>
                <div>
                  <Badge variant={response.recommendations.evidence_level === 'High' ? 'success' : 
                              response.recommendations.evidence_level === 'Moderate' ? 'warning' : 'error'}>
                    {response.recommendations.evidence_level} Evidence
                  </Badge>
                </div>
              </RecommendationHeader>

              <ConfidenceScore>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Confidence: {Math.round(response.confidence_score * 100)}%
                </span>
                <ScoreBar score={response.confidence_score} />
              </ConfidenceScore>

              <RecommendationContent>
                {response.recommendations.primary_recommendation}
              </RecommendationContent>

              <SectionTitle>
                <CheckCircle size={20} />
                Supporting Evidence
              </SectionTitle>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                {response.recommendations.evidence_summary}
              </div>

              <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
                {response.recommendations.supporting_evidence.slice(0, 3).map((evidence, index) => (
                  <ListItem key={index}>
                    <strong>{evidence.journal}:</strong> {evidence.title}
                    <br />
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {evidence.key_finding} ({evidence.study_type})
                    </span>
                  </ListItem>
                ))}
              </ul>

              {response.recommendations.contraindications.length > 0 && (
                <>
                  <SectionTitle>
                    <AlertCircle size={20} />
                    Contraindications & Considerations
                  </SectionTitle>
                  <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
                    {response.recommendations.contraindications.map((contraindication, index) => (
                      <ListItem key={index} style={{ color: '#dc2626' }}>
                        {contraindication}
                      </ListItem>
                    ))}
                  </ul>
                </>
              )}

              <SectionTitle>
                <Clock size={20} />
                Follow-up Actions
              </SectionTitle>
              <ul style={{ paddingLeft: '1.5rem' }}>
                {response.recommendations.follow_up_actions.map((action, index) => (
                  <ListItem key={index}>{action}</ListItem>
                ))}
              </ul>

              <DisclaimerBox>
                <AlertCircle size={20} color="#f59e0b" />
                <DisclaimerContent>
                  {response.recommendations.disclaimer}
                </DisclaimerContent>
              </DisclaimerBox>
            </RecommendationCard>

            {response.sources.length > 0 && (
              <Card>
                <SectionTitle>
                  <ExternalLink size={20} />
                  Supporting Research ({response.sources.length} papers)
                </SectionTitle>
                
                <SourcesGrid>
                  {response.sources.map((source) => (
                    <SourceCard
                      key={source.pmid}
                      onClick={() => window.open(source.url, '_blank')}
                    >
                      <SourceTitle>{source.title}</SourceTitle>
                      <SourceMeta>
                        <div>
                          <strong>{source.journal}</strong> • {source.pub_date}
                        </div>
                        <div>
                          {source.authors.slice(0, 3).join(', ')}
                          {source.authors.length > 3 && ` et al.`}
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                          <RelevanceScore score={source.relevance_score}>
                            {Math.round(source.relevance_score * 100)}% relevant
                          </RelevanceScore>
                        </div>
                      </SourceMeta>
                    </SourceCard>
                  ))}
                </SourcesGrid>
              </Card>
            )}

            <div style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280', 
              textAlign: 'center', 
              marginTop: '1rem' 
            }}>
              Processing completed in {response.processing_time.toFixed(2)} seconds
            </div>
          </ResponseSection>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default ClinicalQuery;