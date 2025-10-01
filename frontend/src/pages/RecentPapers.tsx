import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Calendar, 
  ExternalLink, 
  Filter,
  BookOpen,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Badge from '../components/ui/Badge';

interface Paper {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pub_date: string;
  abstract: string;
  keywords: string[];
  mesh_terms: string[];
  source: string;
  retrieved_at: string;
}

interface SearchResponse {
  query: string;
  total_results: number;
  papers: Paper[];
  timestamp: string;
}

const Container = styled.div`
  max-width: 1200px;
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
  max-width: 600px;
  margin: 0 auto;
`;

const SearchSection = styled(Card)`
  margin-bottom: 2rem;
`;

const SearchForm = styled.form`
  display: flex;
  gap: 1rem;
  align-items: end;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SearchInputGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const SearchInput = styled.input`
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
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

const FilterGroup = styled.div`
  display: flex;
  gap: 1rem;
  align-items: end;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 120px;
`;

const FilterInput = styled.select`
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

const ResultsSection = styled.div`
  margin-top: 2rem;
`;

const ResultsHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const ResultsTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ResultsMeta = styled.div`
  font-size: 0.875rem;
  color: #6b7280;
`;

const PapersGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const PaperCard = styled(Card)`
  padding: 1.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
  }
`;

const PaperHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const PaperTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  flex: 1;
`;

const PaperMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const PaperAbstract = styled.p`
  line-height: 1.6;
  color: #374151;
  margin-bottom: 1rem;
`;

const PaperFooter = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
`;

const ActionButton = styled(Button)`
  min-width: 120px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
`;

const EmptyStateIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: #9ca3af;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const EmptyStateDescription = styled.p`
  color: #6b7280;
  max-width: 400px;
  margin: 0 auto;
`;

const RecentPapers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLimit, setSelectedLimit] = useState('20');
  const [selectedDays, setSelectedDays] = useState('30');

  const { data, isLoading, error, refetch } = useQuery<SearchResponse>(
    ['recent-papers', searchQuery, selectedLimit, selectedDays],
    async () => {
      if (!searchQuery.trim()) {
        // Default search for recent clinical papers
        const response = await axios.get('/api/v1/search/recent', {
          params: {
            query: 'clinical trial OR randomized controlled trial OR systematic review',
            limit: selectedLimit,
            days_back: selectedDays,
          },
        });
        return response.data;
      }
      
      const response = await axios.get('/api/v1/search/recent', {
        params: {
          query: searchQuery,
          limit: selectedLimit,
          days_back: selectedDays,
        },
      });
      return response.data;
    },
    {
      enabled: true, // Auto-fetch on mount
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const truncateAbstract = (abstract: string, maxLength: number = 300) => {
    if (abstract.length <= maxLength) return abstract;
    return abstract.substr(0, maxLength) + '...';
  };

  return (
    <Container>
      <Header>
        <Title>Recent Medical Literature</Title>
        <Subtitle>
          Discover the latest research papers from PubMed with AI-powered insights and relevance analysis
        </Subtitle>
      </Header>

      <SearchSection>
        <SearchForm onSubmit={handleSearch}>
          <SearchInputGroup>
            <Label htmlFor="search">Search Query</Label>
            <SearchInput
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter keywords, conditions, treatments... (e.g., 'diabetes management', 'cardiac surgery')"
            />
          </SearchInputGroup>

          <FilterGroup>
            <FilterInputGroup>
              <Label htmlFor="days">Time Range</Label>
              <FilterInput
                id="days"
                value={selectedDays}
                onChange={(e) => setSelectedDays(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 3 months</option>
                <option value="365">Last year</option>
              </FilterInput>
            </FilterInputGroup>

            <FilterInputGroup>
              <Label htmlFor="limit">Results</Label>
              <FilterInput
                id="limit"
                value={selectedLimit}
                onChange={(e) => setSelectedLimit(e.target.value)}
              >
                <option value="10">10 papers</option>
                <option value="20">20 papers</option>
                <option value="50">50 papers</option>
                <option value="100">100 papers</option>
              </FilterInput>
            </FilterInputGroup>

            <Button
              type="submit"
              loading={isLoading}
              icon={<Search />}
              disabled={isLoading}
            >
              Search
            </Button>
          </FilterGroup>
        </SearchForm>
      </SearchSection>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}
          >
            <LoadingSpinner size="large" />
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card padding="large">
              <EmptyState>
                <EmptyStateIcon>
                  <Search size={48} />
                </EmptyStateIcon>
                <EmptyStateTitle>Search Error</EmptyStateTitle>
                <EmptyStateDescription>
                  Unable to search for papers. Please check your connection and try again.
                </EmptyStateDescription>
              </EmptyState>
            </Card>
          </motion.div>
        )}

        {data && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultsSection>
              <ResultsHeader>
                <ResultsTitle>
                  <BookOpen size={24} />
                  Search Results
                </ResultsTitle>
                <ResultsMeta>
                  Found {data.total_results} papers • Updated {new Date(data.timestamp).toLocaleTimeString()}
                </ResultsMeta>
              </ResultsHeader>

              {data.papers.length === 0 ? (
                <Card padding="large">
                  <EmptyState>
                    <EmptyStateIcon>
                      <Search size={48} />
                    </EmptyStateIcon>
                    <EmptyStateTitle>No Papers Found</EmptyStateTitle>
                    <EmptyStateDescription>
                      No recent papers match your search criteria. Try adjusting your search terms or time range.
                    </EmptyStateDescription>
                  </EmptyState>
                </Card>
              ) : (
                <PapersGrid>
                  {data.papers.map((paper, index) => (
                    <motion.div
                      key={paper.pmid}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <PaperCard
                        onClick={() => window.open(`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`, '_blank')}
                      >
                        <PaperHeader>
                          <div style={{ flex: 1 }}>
                            <PaperTitle>{paper.title}</PaperTitle>
                            <PaperMeta>
                              <MetaItem>
                                <Users size={14} />
                                {paper.authors.slice(0, 3).join(', ')}
                                {paper.authors.length > 3 && ' et al.'}
                              </MetaItem>
                              <MetaItem>
                                <BookOpen size={14} />
                                {paper.journal}
                              </MetaItem>
                              <MetaItem>
                                <Calendar size={14} />
                                {formatDate(paper.pub_date)}
                              </MetaItem>
                              <MetaItem>
                                <Clock size={14} />
                                PMID: {paper.pmid}
                              </MetaItem>
                            </PaperMeta>
                          </div>
                        </PaperHeader>

                        {paper.abstract && (
                          <PaperAbstract>
                            {truncateAbstract(paper.abstract)}
                          </PaperAbstract>
                        )}

                        <PaperFooter>
                          <TagsContainer>
                            {paper.keywords?.slice(0, 4).map((keyword, idx) => (
                              <Badge key={idx} variant="info" size="small">
                                {keyword}
                              </Badge>
                            ))}
                            {paper.mesh_terms?.slice(0, 3).map((term, idx) => (
                              <Badge key={`mesh-${idx}`} variant="default" size="small">
                                {term}
                              </Badge>
                            ))}
                          </TagsContainer>

                          <ActionButton
                            variant="outline"
                            size="small"
                            icon={<ExternalLink />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              window.open(`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`, '_blank');
                            }}
                          >
                            View on PubMed
                          </ActionButton>
                        </PaperFooter>
                      </PaperCard>
                    </motion.div>
                  ))}
                </PapersGrid>
              )}
            </ResultsSection>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default RecentPapers;