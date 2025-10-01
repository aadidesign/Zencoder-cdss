import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { 
  Search, 
  Mic, 
  MicOff, 
  Send, 
  FileText, 
  Brain, 
  Zap,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Loader,
  BookOpen,
  Stethoscope,
  Activity,
  Heart,
  Pill,
  Shield,
  Target,
  TrendingUp,
  Star,
  MessageSquare,
  Filter,
  Download,
  Share2,
  History,
  Bookmark,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Select from 'react-select';
import { useSpeechSynthesis, useSpeechRecognition } from 'react-speech-kit';
import { useInView } from 'react-intersection-observer';
import { FixedSizeList as List } from 'react-window';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

// Enhanced styled components with modern design
const QueryContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
`;

const QueryHeader = styled(motion.div)`
  text-align: center;
  margin-bottom: 3rem;
  
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  p {
    font-size: 1.1rem;
    color: #64748b;
    max-width: 600px;
    margin: 0 auto;
  }
`;

const QueryFormCard = styled(motion.div)`
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  margin-bottom: 2rem;
`;

const QueryInputGroup = styled.div`
  position: relative;
  margin-bottom: 1.5rem;
`;

const QueryTextarea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  min-height: 120px;
  padding: 1rem 3.5rem 1rem 1rem;
  border: 2px solid ${props => props.hasError ? '#ef4444' : '#e2e8f0'};
  border-radius: 12px;
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.2s ease;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const VoiceInputButton = styled(motion.button)<{ isListening?: boolean }>`
  position: absolute;
  right: 1rem;
  top: 1rem;
  width: 40px;
  height: 40px;
  border: none;
  background: ${props => props.isListening ? '#ef4444' : '#3b82f6'};
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PatientContextGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ContextCard = styled(motion.div)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  
  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const QuickSuggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 2rem;
`;

const SuggestionChip = styled(motion.button)`
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 0.875rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const SubmitButton = styled(motion.button)<{ isLoading?: boolean }>`
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ProcessingSteps = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
`;

const StepItem = styled(motion.div)<{ isActive?: boolean; isCompleted?: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: ${props => 
    props.isActive ? '#eff6ff' : 
    props.isCompleted ? '#f0fdf4' : 
    'transparent'
  };
  border: 1px solid ${props => 
    props.isActive ? '#3b82f6' : 
    props.isCompleted ? '#10b981' : 
    'transparent'
  };
  
  .step-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => 
      props.isCompleted ? '#10b981' : 
      props.isActive ? '#3b82f6' : 
      '#e5e7eb'
    };
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
  
  .step-content {
    flex: 1;
    
    h4 {
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.25rem;
    }
    
    p {
      font-size: 0.875rem;
      color: #6b7280;
    }
  }
`;

const ResultsContainer = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
`;

const ResultCard = styled(motion.div)`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ConfidenceBar = styled.div<{ confidence: number }>`
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  margin: 1rem 0;
  
  &::after {
    content: '';
    display: block;
    width: ${props => props.confidence}%;
    height: 100%;
    background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981);
    border-radius: 2px;
    transition: width 0.5s ease;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
`;

const ActionButton = styled(motion.button)`
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    transform: translateY(-1px);
  }
`;

// Form validation schema
const clinicalQuerySchema = z.object({
  query: z.string().min(10, 'Query must be at least 10 characters'),
  patientAge: z.number().min(0).max(150).optional(),
  patientGender: z.enum(['male', 'female', 'other']).optional(),
  medicalHistory: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  symptoms: z.array(z.string()).optional(),
  vitalSigns: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.number().optional(),
    temperature: z.number().optional(),
    respiratoryRate: z.number().optional(),
    oxygenSaturation: z.number().optional(),
  }).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  specialty: z.string().optional(),
});

type ClinicalQueryForm = z.infer<typeof clinicalQuerySchema>;

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  timestamp?: Date;
  duration?: number;
}

interface ClinicalRecommendation {
  id: string;
  title: string;
  description: string;
  confidence: number;
  evidenceLevel: string;
  sources: Array<{
    title: string;
    authors: string[];
    journal: string;
    year: number;
    pmid: string;
    url: string;
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
  recommendations: Array<{
    type: 'diagnostic' | 'therapeutic' | 'monitoring' | 'referral';
    content: string;
    priority: number;
  }>;
  contraindications: string[];
  followUpInstructions: string[];
}

const ClinicalQueryEnhanced: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [recommendations, setRecommendations] = useState<ClinicalRecommendation[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { ref: resultsRef, inView: resultsInView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const { speak, speaking, cancel } = useSpeechSynthesis();
  const { listen, listening, stop } = useSpeechRecognition({
    onResult: (result) => {
      setValue('query', result);
    },
    onEnd: () => {
      setIsListening(false);
    }
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<ClinicalQueryForm>({
    resolver: zodResolver(clinicalQuerySchema),
    defaultValues: {
      urgencyLevel: 'medium',
      patientGender: 'other'
    }
  });

  const queryValue = watch('query');

  const quickSuggestions = [
    "Treatment options for acute myocardial infarction",
    "Differential diagnosis for chest pain in elderly",
    "Antibiotic selection for pneumonia",
    "Management of type 2 diabetes complications",
    "Stroke assessment and treatment protocol",
    "Pediatric fever evaluation guidelines",
    "Chronic pain management strategies",
    "Cancer screening recommendations",
  ];

  const medicalConditionsOptions = [
    { value: 'hypertension', label: 'Hypertension' },
    { value: 'diabetes', label: 'Diabetes Mellitus' },
    { value: 'copd', label: 'COPD' },
    { value: 'heart_disease', label: 'Heart Disease' },
    { value: 'cancer', label: 'Cancer' },
    { value: 'kidney_disease', label: 'Kidney Disease' },
    { value: 'liver_disease', label: 'Liver Disease' },
    { value: 'mental_health', label: 'Mental Health Conditions' },
  ];

  const medicationsOptions = [
    { value: 'metformin', label: 'Metformin' },
    { value: 'lisinopril', label: 'Lisinopril' },
    { value: 'amlodipine', label: 'Amlodipine' },
    { value: 'atorvastatin', label: 'Atorvastatin' },
    { value: 'levothyroxine', label: 'Levothyroxine' },
    { value: 'omeprazole', label: 'Omeprazole' },
    { value: 'aspirin', label: 'Aspirin' },
    { value: 'warfarin', label: 'Warfarin' },
  ];

  const specialtyOptions = [
    { value: 'cardiology', label: 'Cardiology' },
    { value: 'oncology', label: 'Oncology' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'emergency', label: 'Emergency Medicine' },
    { value: 'internal', label: 'Internal Medicine' },
    { value: 'pediatrics', label: 'Pediatrics' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'psychiatry', label: 'Psychiatry' },
  ];

  const defaultProcessingSteps: ProcessingStep[] = [
    {
      id: 'analyzing',
      title: 'Analyzing Query',
      description: 'Processing clinical query and extracting key medical entities',
      status: 'pending'
    },
    {
      id: 'searching',
      title: 'Searching Literature',
      description: 'Finding relevant research papers from PubMed database',
      status: 'pending'
    },
    {
      id: 'embedding',
      title: 'Creating Embeddings',
      description: 'Generating semantic embeddings using PubMedBERT',
      status: 'pending'
    },
    {
      id: 'matching',
      title: 'Matching Evidence',
      description: 'Finding most relevant medical evidence and guidelines',
      status: 'pending'
    },
    {
      id: 'generating',
      title: 'Generating Recommendations',
      description: 'Creating evidence-based clinical recommendations',
      status: 'pending'
    }
  ];

  const handleVoiceInput = useCallback(() => {
    if (isListening) {
      stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      listen();
    }
  }, [isListening, listen, stop]);

  const handleSuggestionClick = (suggestion: string) => {
    setValue('query', suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const debouncedAutoSave = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        localStorage.setItem('cdss-draft-query', query);
      }
    }, 1000),
    []
  );

  useEffect(() => {
    if (queryValue) {
      debouncedAutoSave(queryValue);
    }
  }, [queryValue, debouncedAutoSave]);

  useEffect(() => {
    // Load draft query on component mount
    const draftQuery = localStorage.getItem('cdss-draft-query');
    if (draftQuery) {
      setValue('query', draftQuery);
    }

    // Load query history
    const history = localStorage.getItem('cdss-query-history');
    if (history) {
      setQueryHistory(JSON.parse(history));
    }
  }, [setValue]);

  const onSubmit = async (data: ClinicalQueryForm) => {
    setIsSubmitting(true);
    setProcessingSteps(defaultProcessingSteps);
    setRecommendations([]);
    setCurrentStep('analyzing');

    try {
      // Simulate processing steps
      for (let i = 0; i < defaultProcessingSteps.length; i++) {
        const step = defaultProcessingSteps[i];
        
        setProcessingSteps(prev => prev.map(s => 
          s.id === step.id ? { ...s, status: 'active', timestamp: new Date() } : s
        ));
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setProcessingSteps(prev => prev.map(s => 
          s.id === step.id ? { 
            ...s, 
            status: 'completed', 
            duration: Math.random() * 3000 + 500 
          } : s
        ));
      }

      // Simulate successful response
      const mockRecommendations: ClinicalRecommendation[] = [
        {
          id: '1',
          title: 'Primary Treatment Recommendation',
          description: 'Based on current evidence and patient factors, the recommended primary treatment approach includes...',
          confidence: 85,
          evidenceLevel: 'A',
          sources: [
            {
              title: 'Clinical outcomes of early intervention in acute conditions',
              authors: ['Smith J', 'Johnson A', 'Williams B'],
              journal: 'New England Journal of Medicine',
              year: 2023,
              pmid: '12345678',
              url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/'
            }
          ],
          riskAssessment: {
            level: 'medium',
            factors: ['Age-related considerations', 'Drug interactions', 'Comorbidities']
          },
          recommendations: [
            {
              type: 'therapeutic',
              content: 'Initiate evidence-based therapy with monitoring',
              priority: 1
            },
            {
              type: 'monitoring',
              content: 'Regular follow-up appointments every 2 weeks',
              priority: 2
            }
          ],
          contraindications: ['Known allergy to prescribed medications'],
          followUpInstructions: ['Monitor symptoms daily', 'Return if condition worsens']
        }
      ];

      setRecommendations(mockRecommendations);

      // Save to history
      const newHistory = [data.query, ...queryHistory.slice(0, 9)];
      setQueryHistory(newHistory);
      localStorage.setItem('cdss-query-history', JSON.stringify(newHistory));
      localStorage.removeItem('cdss-draft-query');

      toast.success('Clinical recommendations generated successfully!');

    } catch (error) {
      console.error('Query submission error:', error);
      toast.error('Failed to process clinical query. Please try again.');
      
      setProcessingSteps(prev => prev.map(s => 
        s.status === 'active' ? { ...s, status: 'error' } : s
      ));
    } finally {
      setIsSubmitting(false);
      setCurrentStep(null);
    }
  };

  const handleSpeakResult = (text: string) => {
    if (speaking) {
      cancel();
    } else {
      speak({ text });
    }
  };

  const handleDownloadReport = (recommendation: ClinicalRecommendation) => {
    const reportData = {
      timestamp: new Date().toISOString(),
      query: queryValue,
      recommendation,
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Report downloaded successfully!');
  };

  return (
    <QueryContainer>
      <QueryHeader
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>Advanced Clinical Decision Support</h1>
        <p>
          Get evidence-based clinical recommendations powered by PubMedBERT and real-time literature analysis.
          Ask complex clinical questions and receive comprehensive, peer-reviewed guidance.
        </p>
      </QueryHeader>

      <QueryFormCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <QueryInputGroup>
            <Controller
              name="query"
              control={control}
              render={({ field }) => (
                <QueryTextarea
                  {...field}
                  ref={textareaRef}
                  placeholder="Describe your clinical question in detail. Include patient demographics, symptoms, medical history, and specific areas of concern..."
                  hasError={!!errors.query}
                  rows={4}
                />
              )}
            />
            
            <VoiceInputButton
              type="button"
              onClick={handleVoiceInput}
              isListening={isListening}
              whileTap={{ scale: 0.95 }}
              data-tooltip-id="voice-tooltip"
              data-tooltip-content={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </VoiceInputButton>
            
            <Tooltip id="voice-tooltip" />
            
            {errors.query && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}
              >
                {errors.query.message}
              </motion.div>
            )}
          </QueryInputGroup>

          <QuickSuggestions>
            {quickSuggestions.map((suggestion, index) => (
              <SuggestionChip
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {suggestion}
              </SuggestionChip>
            ))}
          </QuickSuggestions>

          <motion.div
            style={{ marginBottom: '1.5rem' }}
          >
            <motion.button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
              whileHover={{ scale: 1.02 }}
            >
              <Settings size={16} />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </motion.button>
          </motion.div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <PatientContextGrid>
                  <ContextCard
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <h3><User size={16} />Patient Demographics</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <Controller
                        name="patientAge"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            placeholder="Patient age"
                            min="0"
                            max="150"
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '0.875rem'
                            }}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        )}
                      />
                      
                      <Controller
                        name="patientGender"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={[
                              { value: 'male', label: 'Male' },
                              { value: 'female', label: 'Female' },
                              { value: 'other', label: 'Other/Prefer not to say' }
                            ]}
                            placeholder="Gender"
                            styles={{
                              control: (base) => ({
                                ...base,
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.875rem'
                              })
                            }}
                          />
                        )}
                      />
                    </div>
                  </ContextCard>

                  <ContextCard
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <h3><Heart size={16} />Medical History</h3>
                    <Controller
                      name="medicalHistory"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          isMulti
                          options={medicalConditionsOptions}
                          placeholder="Select conditions..."
                          styles={{
                            control: (base) => ({
                              ...base,
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '0.875rem'
                            })
                          }}
                        />
                      )}
                    />
                  </ContextCard>

                  <ContextCard
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <h3><Pill size={16} />Current Medications</h3>
                    <Controller
                      name="currentMedications"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          isMulti
                          options={medicationsOptions}
                          placeholder="Select medications..."
                          styles={{
                            control: (base) => ({
                              ...base,
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '0.875rem'
                            })
                          }}
                        />
                      )}
                    />
                  </ContextCard>

                  <ContextCard
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <h3><Stethoscope size={16} />Specialty Focus</h3>
                    <Controller
                      name="specialty"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          options={specialtyOptions}
                          placeholder="Select specialty..."
                          isClearable
                          styles={{
                            control: (base) => ({
                              ...base,
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '0.875rem'
                            })
                          }}
                        />
                      )}
                    />
                  </ContextCard>

                  <ContextCard
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  >
                    <h3><AlertCircle size={16} />Urgency Level</h3>
                    <Controller
                      name="urgencyLevel"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          options={[
                            { value: 'low', label: 'Low - Routine consultation' },
                            { value: 'medium', label: 'Medium - Within hours' },
                            { value: 'high', label: 'High - Immediate attention' },
                            { value: 'emergency', label: 'Emergency - Critical' }
                          ]}
                          styles={{
                            control: (base) => ({
                              ...base,
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '0.875rem'
                            })
                          }}
                        />
                      )}
                    />
                  </ContextCard>
                </PatientContextGrid>
              </motion.div>
            )}
          </AnimatePresence>

          <SubmitButton
            type="submit"
            disabled={isSubmitting || !queryValue?.trim()}
            isLoading={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSubmitting ? (
              <>
                <Loader size={20} className="animate-spin" />
                Processing Query...
              </>
            ) : (
              <>
                <Brain size={20} />
                Generate Clinical Recommendations
              </>
            )}
          </SubmitButton>
        </form>
      </QueryFormCard>

      {/* Processing Steps */}
      <AnimatePresence>
        {processingSteps.length > 0 && (
          <ProcessingSteps
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} />
              Processing Clinical Query
            </h3>
            
            {processingSteps.map((step, index) => (
              <StepItem
                key={step.id}
                isActive={step.status === 'active'}
                isCompleted={step.status === 'completed'}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className="step-icon">
                  {step.status === 'completed' ? (
                    <CheckCircle size={14} />
                  ) : step.status === 'active' ? (
                    <Loader size={14} className="animate-spin" />
                  ) : step.status === 'error' ? (
                    <AlertCircle size={14} />
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div className="step-content">
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                  {step.timestamp && (
                    <small style={{ color: '#9ca3af' }}>
                      {format(step.timestamp, 'HH:mm:ss')}
                      {step.duration && ` • ${Math.round(step.duration)}ms`}
                    </small>
                  )}
                </div>
              </StepItem>
            ))}
          </ProcessingSteps>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {recommendations.length > 0 && (
          <ResultsContainer
            ref={resultsRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: resultsInView ? 1 : 0, y: resultsInView ? 0 : 20 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={20} />
              Clinical Recommendations
            </h3>

            {recommendations.map((recommendation, index) => (
              <ResultCard
                key={recommendation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
                    {recommendation.title}
                  </h4>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      background: recommendation.evidenceLevel === 'A' ? '#10b981' : 
                                 recommendation.evidenceLevel === 'B' ? '#f59e0b' : '#ef4444',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      Evidence Level {recommendation.evidenceLevel}
                    </span>
                  </div>
                </div>

                <ReactMarkdown>{recommendation.description}</ReactMarkdown>

                <div style={{ margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Confidence Score</span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{recommendation.confidence}%</span>
                  </div>
                  <ConfidenceBar confidence={recommendation.confidence} />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={16} />
                    Risk Assessment
                  </h5>
                  <div style={{
                    padding: '0.75rem',
                    background: recommendation.riskAssessment.level === 'low' ? '#f0fdf4' : 
                               recommendation.riskAssessment.level === 'medium' ? '#fefce8' : '#fef2f2',
                    border: `1px solid ${recommendation.riskAssessment.level === 'low' ? '#bbf7d0' : 
                                        recommendation.riskAssessment.level === 'medium' ? '#fef08a' : '#fecaca'}`,
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Risk Level: <span style={{ textTransform: 'capitalize' }}>{recommendation.riskAssessment.level}</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                      {recommendation.riskAssessment.factors.map((factor, idx) => (
                        <li key={idx} style={{ fontSize: '0.875rem', color: '#6b7280' }}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Clinical Recommendations
                  </h5>
                  {recommendation.recommendations
                    .sort((a, b) => a.priority - b.priority)
                    .map((rec, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        gap: '0.75rem',
                        marginBottom: '0.5rem',
                        padding: '0.5rem',
                        background: '#f8fafc',
                        borderRadius: '6px'
                      }}>
                        <span style={{
                          background: rec.type === 'diagnostic' ? '#3b82f6' :
                                     rec.type === 'therapeutic' ? '#10b981' :
                                     rec.type === 'monitoring' ? '#f59e0b' : '#8b5cf6',
                          color: 'white',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap'
                        }}>
                          {rec.type}
                        </span>
                        <span style={{ fontSize: '0.875rem' }}>{rec.content}</span>
                      </div>
                    ))}
                </div>

                <ActionButtons>
                  <ActionButton
                    onClick={() => handleSpeakResult(recommendation.description)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {speaking ? <Eye size={14} /> : <EyeOff size={14} />}
                    {speaking ? 'Stop Reading' : 'Read Aloud'}
                  </ActionButton>
                  
                  <ActionButton
                    onClick={() => handleDownloadReport(recommendation)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download size={14} />
                    Download Report
                  </ActionButton>
                  
                  <ActionButton
                    onClick={() => {
                      navigator.clipboard.writeText(recommendation.description);
                      toast.success('Copied to clipboard!');
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Share2 size={14} />
                    Copy
                  </ActionButton>
                  
                  <ActionButton
                    onClick={() => {
                      // Save to bookmarks
                      const bookmarks = JSON.parse(localStorage.getItem('cdss-bookmarks') || '[]');
                      bookmarks.push({
                        id: recommendation.id,
                        query: queryValue,
                        recommendation: recommendation.title,
                        timestamp: new Date().toISOString()
                      });
                      localStorage.setItem('cdss-bookmarks', JSON.stringify(bookmarks));
                      toast.success('Saved to bookmarks!');
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bookmark size={14} />
                    Bookmark
                  </ActionButton>
                </ActionButtons>

                {recommendation.sources.length > 0 && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookOpen size={14} />
                      Supporting Evidence ({recommendation.sources.length} sources)
                    </h5>
                    {recommendation.sources.map((source, idx) => (
                      <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'none' }}
                        >
                          {source.title}
                        </a>
                        <div>{source.authors.join(', ')} • {source.journal} ({source.year})</div>
                      </div>
                    ))}
                  </div>
                )}
              </ResultCard>
            ))}
          </ResultsContainer>
        )}
      </AnimatePresence>
    </QueryContainer>
  );
};

export default ClinicalQueryEnhanced;