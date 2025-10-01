"""
Clinical text processing and recommendation generation
"""

import re
from typing import Dict, List, Optional, NamedTuple
from datetime import datetime
import json
from loguru import logger

import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np


class ExpandedQuery(NamedTuple):
    """Expanded clinical query with search terms and filters"""
    original_query: str
    enhanced_query: str
    search_terms: List[str]
    filters: Dict
    clinical_entities: List[str]


class ClinicalRecommendation(NamedTuple):
    """Clinical recommendation structure"""
    primary_recommendation: str
    evidence_level: str
    confidence_score: float
    supporting_evidence: List[Dict]
    contraindications: List[str]
    follow_up_actions: List[str]


class ClinicalProcessor:
    """Processes clinical queries and generates recommendations"""
    
    def __init__(self):
        # Clinical entity patterns
        self.medical_conditions = {
            r'\b(hypertension|diabetes|asthma|copd|cancer|pneumonia|sepsis|stroke|myocardial infarction|heart failure)\b',
            r'\b(acute coronary syndrome|atrial fibrillation|congestive heart failure|chronic kidney disease)\b',
            r'\b(depression|anxiety|bipolar|schizophrenia|dementia|alzheimer)\b',
            r'\b(covid-19|coronavirus|sars-cov-2|influenza|tuberculosis|hiv|hepatitis)\b'
        }
        
        self.medications = {
            r'\b(aspirin|metformin|lisinopril|atorvastatin|amlodipine|metoprolol|omeprazole)\b',
            r'\b(warfarin|heparin|insulin|albuterol|prednisone|azithromycin|amoxicillin)\b',
            r'\b(morphine|fentanyl|tramadol|ibuprofen|acetaminophen|gabapentin)\b'
        }
        
        self.procedures = {
            r'\b(surgery|operation|procedure|biopsy|catheterization|intubation|ventilation)\b',
            r'\b(ct scan|mri|x-ray|ultrasound|ecg|ekg|echocardiogram)\b',
            r'\b(blood test|urinalysis|culture|pathology|histology)\b'
        }
        
        self.vital_signs = {
            r'\b(blood pressure|heart rate|temperature|oxygen saturation|respiratory rate)\b',
            r'\b(bp|hr|temp|o2 sat|rr|spo2)\b'
        }
    
    async def expand_clinical_query(
        self,
        query: str,
        patient_context: Optional[Dict] = None
    ) -> ExpandedQuery:
        """Expand clinical query with medical entities and context"""
        
        logger.info("Expanding clinical query with medical entities")
        
        try:
            query_lower = query.lower()
            
            # Extract clinical entities
            clinical_entities = self._extract_clinical_entities(query_lower)
            
            # Generate search terms
            search_terms = self._generate_search_terms(query, clinical_entities, patient_context)
            
            # Create enhanced query
            enhanced_query = self._create_enhanced_query(query, clinical_entities, patient_context)
            
            # Generate filters
            filters = self._generate_filters(patient_context)
            
            return ExpandedQuery(
                original_query=query,
                enhanced_query=enhanced_query,
                search_terms=search_terms,
                filters=filters,
                clinical_entities=clinical_entities
            )
        
        except Exception as e:
            logger.error(f"Error expanding clinical query: {e}")
            return ExpandedQuery(
                original_query=query,
                enhanced_query=query,
                search_terms=[query],
                filters={},
                clinical_entities=[]
            )
    
    def _extract_clinical_entities(self, query: str) -> List[str]:
        """Extract clinical entities from query"""
        entities = []
        
        # Extract medical conditions
        for pattern in self.medical_conditions:
            matches = re.findall(pattern, query, re.IGNORECASE)
            entities.extend(matches)
        
        # Extract medications
        for pattern in self.medications:
            matches = re.findall(pattern, query, re.IGNORECASE)
            entities.extend(matches)
        
        # Extract procedures
        for pattern in self.procedures:
            matches = re.findall(pattern, query, re.IGNORECASE)
            entities.extend(matches)
        
        # Extract vital signs
        for pattern in self.vital_signs:
            matches = re.findall(pattern, query, re.IGNORECASE)
            entities.extend(matches)
        
        # Remove duplicates and return
        return list(set(entities))
    
    def _generate_search_terms(
        self,
        query: str,
        entities: List[str],
        patient_context: Optional[Dict]
    ) -> List[str]:
        """Generate search terms for PubMed"""
        
        search_terms = [query]
        
        # Add clinical entities
        search_terms.extend(entities)
        
        # Add patient context terms
        if patient_context:
            age = patient_context.get("age")
            gender = patient_context.get("gender")
            conditions = patient_context.get("existing_conditions", [])
            
            if age:
                age_group = self._get_age_group(age)
                if age_group:
                    search_terms.append(age_group)
            
            if gender:
                search_terms.append(gender)
            
            search_terms.extend(conditions)
        
        # Remove duplicates and empty strings
        search_terms = list(set([term.strip() for term in search_terms if term.strip()]))
        
        return search_terms[:10]  # Limit to prevent overly complex queries
    
    def _create_enhanced_query(
        self,
        original_query: str,
        entities: List[str],
        patient_context: Optional[Dict]
    ) -> str:
        """Create enhanced query for semantic search"""
        
        parts = [original_query]
        
        if entities:
            parts.append("Medical entities: " + ", ".join(entities))
        
        if patient_context:
            context_parts = []
            
            age = patient_context.get("age")
            if age:
                context_parts.append(f"age {age}")
            
            gender = patient_context.get("gender")
            if gender:
                context_parts.append(gender)
            
            conditions = patient_context.get("existing_conditions", [])
            if conditions:
                context_parts.append("conditions: " + ", ".join(conditions))
            
            if context_parts:
                parts.append("Patient context: " + ", ".join(context_parts))
        
        return ". ".join(parts)
    
    def _generate_filters(self, patient_context: Optional[Dict]) -> Dict:
        """Generate filters for search"""
        filters = {}
        
        # Default to recent papers (last 5 years)
        current_year = datetime.now().year
        filters["min_date"] = f"{current_year - 5}"
        
        return filters
    
    def _get_age_group(self, age: int) -> Optional[str]:
        """Get age group for medical context"""
        if age < 18:
            return "pediatric"
        elif age < 65:
            return "adult"
        else:
            return "geriatric"
    
    async def generate_recommendations(
        self,
        query: str,
        patient_context: Optional[Dict],
        relevant_documents: List[Dict],
        model: AutoModel,
        tokenizer: AutoTokenizer
    ) -> Dict:
        """Generate clinical recommendations based on evidence"""
        
        logger.info("Generating clinical recommendations")
        start_time = datetime.now()
        
        try:
            if not relevant_documents:
                return {
                    "primary_recommendation": "Insufficient evidence found. Please consult with a healthcare provider.",
                    "evidence_level": "Low",
                    "confidence_score": 0.1,
                    "supporting_evidence": [],
                    "contraindications": ["Consult healthcare provider before any clinical decisions"],
                    "follow_up_actions": ["Seek professional medical advice"],
                    "processing_time": (datetime.now() - start_time).total_seconds(),
                    "disclaimer": "This system provides general information only and should not replace professional medical advice."
                }
            
            # Analyze evidence quality
            evidence_analysis = self._analyze_evidence_quality(relevant_documents)
            
            # Generate primary recommendation
            primary_recommendation = self._generate_primary_recommendation(
                query, relevant_documents, patient_context
            )
            
            # Extract supporting evidence
            supporting_evidence = self._extract_supporting_evidence(relevant_documents)
            
            # Identify contraindications
            contraindications = self._identify_contraindications(
                relevant_documents, patient_context
            )
            
            # Generate follow-up actions
            follow_up_actions = self._generate_follow_up_actions(
                query, relevant_documents, patient_context
            )
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(
                evidence_analysis, relevant_documents
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return {
                "primary_recommendation": primary_recommendation,
                "evidence_level": evidence_analysis["level"],
                "confidence_score": confidence_score,
                "supporting_evidence": supporting_evidence,
                "contraindications": contraindications,
                "follow_up_actions": follow_up_actions,
                "evidence_summary": evidence_analysis["summary"],
                "processing_time": processing_time,
                "disclaimer": "This system provides general information only and should not replace professional medical advice. Always consult with qualified healthcare providers for clinical decisions."
            }
        
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return {
                "primary_recommendation": "Error generating recommendations. Please consult with a healthcare provider.",
                "evidence_level": "Unknown",
                "confidence_score": 0.0,
                "supporting_evidence": [],
                "contraindications": ["System error - consult healthcare provider"],
                "follow_up_actions": ["Seek immediate professional medical advice"],
                "processing_time": (datetime.now() - start_time).total_seconds(),
                "disclaimer": "This system provides general information only and should not replace professional medical advice."
            }
    
    def _analyze_evidence_quality(self, documents: List[Dict]) -> Dict:
        """Analyze the quality of evidence from documents"""
        
        high_impact_journals = {
            "new england journal of medicine", "lancet", "jama", "bmj", 
            "nature medicine", "cell", "science", "nature"
        }
        
        study_types = {
            "randomized controlled trial": 5,
            "systematic review": 4,
            "meta-analysis": 4,
            "cohort study": 3,
            "case-control study": 2,
            "case series": 1,
            "case report": 1
        }
        
        total_score = 0
        evidence_count = 0
        recent_papers = 0
        high_impact_count = 0
        
        current_year = datetime.now().year
        
        for doc in documents:
            score = 1
            
            # Journal impact
            journal = doc.get("journal", "").lower()
            if any(hi_journal in journal for hi_journal in high_impact_journals):
                score += 2
                high_impact_count += 1
            
            # Study type
            content = (doc.get("title", "") + " " + doc.get("content", "")).lower()
            for study_type, type_score in study_types.items():
                if study_type in content:
                    score += type_score
                    break
            
            # Recency
            pub_date = doc.get("pub_date", "")
            if pub_date and pub_date.startswith(str(current_year)):
                score += 1
                recent_papers += 1
            elif pub_date and pub_date.startswith(str(current_year - 1)):
                recent_papers += 1
            
            total_score += score
            evidence_count += 1
        
        avg_score = total_score / evidence_count if evidence_count > 0 else 0
        
        # Determine evidence level
        if avg_score >= 6 and high_impact_count >= 2:
            level = "High"
        elif avg_score >= 4 and evidence_count >= 3:
            level = "Moderate"
        elif avg_score >= 2:
            level = "Low"
        else:
            level = "Very Low"
        
        return {
            "level": level,
            "average_score": avg_score,
            "total_papers": evidence_count,
            "recent_papers": recent_papers,
            "high_impact_journals": high_impact_count,
            "summary": f"Evidence based on {evidence_count} papers, {recent_papers} recent, {high_impact_count} from high-impact journals"
        }
    
    def _generate_primary_recommendation(
        self,
        query: str,
        documents: List[Dict],
        patient_context: Optional[Dict]
    ) -> str:
        """Generate primary recommendation based on evidence"""
        
        # Extract key findings from top documents
        key_findings = []
        
        for doc in documents[:3]:  # Focus on top 3 most relevant
            title = doc.get("title", "")
            content = doc.get("content", "")
            
            # Look for conclusive statements
            conclusion_patterns = [
                r'(recommend|suggests?|indicates?|shows?|demonstrates?|concludes?|findings?)[^.]*',
                r'(treatment|therapy|intervention|management)[^.]*',
                r'(effective|efficacy|beneficial|improvement|reduction)[^.]*'
            ]
            
            for pattern in conclusion_patterns:
                matches = re.findall(pattern, content.lower(), re.IGNORECASE)
                key_findings.extend(matches[:2])  # Limit findings per paper
        
        if not key_findings:
            return "Based on available evidence, consult with your healthcare provider for personalized recommendations appropriate to your specific clinical situation."
        
        # Generate recommendation based on findings
        recommendation_parts = [
            "Based on current medical literature:",
            f"Evidence from {len(documents)} recent studies suggests:"
        ]
        
        # Add top findings
        for i, finding in enumerate(key_findings[:3]):
            recommendation_parts.append(f"{i+1}. {finding.strip()}")
        
        recommendation_parts.extend([
            "",
            "However, individual patient factors must be considered.",
            "Please discuss these findings with your healthcare provider for personalized medical advice."
        ])
        
        return " ".join(recommendation_parts)
    
    def _extract_supporting_evidence(self, documents: List[Dict]) -> List[Dict]:
        """Extract supporting evidence from documents"""
        
        evidence = []
        
        for doc in documents[:5]:  # Top 5 documents
            evidence_item = {
                "pmid": doc.get("pmid"),
                "title": doc.get("title", ""),
                "journal": doc.get("journal", ""),
                "pub_date": doc.get("pub_date", ""),
                "relevance_score": doc.get("score", 0),
                "key_finding": self._extract_key_finding(doc),
                "study_type": self._identify_study_type(doc)
            }
            evidence.append(evidence_item)
        
        return evidence
    
    def _extract_key_finding(self, document: Dict) -> str:
        """Extract key finding from document"""
        
        content = document.get("content", "")
        
        # Look for conclusion or results sections
        conclusion_patterns = [
            r'conclusion[s]?[:\-\s]([^.]+)',
            r'results?[:\-\s]([^.]+)', 
            r'findings?[:\-\s]([^.]+)'
        ]
        
        for pattern in conclusion_patterns:
            matches = re.findall(pattern, content.lower(), re.IGNORECASE)
            if matches:
                return matches[0].strip()[:200] + "..."
        
        # Fallback to first sentence of abstract
        sentences = content.split('. ')
        if sentences:
            return sentences[0][:200] + "..."
        
        return "Key finding not extracted"
    
    def _identify_study_type(self, document: Dict) -> str:
        """Identify study type from document"""
        
        content = (document.get("title", "") + " " + document.get("content", "")).lower()
        
        study_types = [
            ("randomized controlled trial", "RCT"),
            ("systematic review", "Systematic Review"),
            ("meta-analysis", "Meta-Analysis"),
            ("cohort study", "Cohort Study"),
            ("case-control study", "Case-Control Study"),
            ("case series", "Case Series"),
            ("case report", "Case Report"),
            ("observational study", "Observational Study"),
            ("clinical trial", "Clinical Trial")
        ]
        
        for pattern, study_type in study_types:
            if pattern in content:
                return study_type
        
        return "Research Study"
    
    def _identify_contraindications(
        self,
        documents: List[Dict],
        patient_context: Optional[Dict]
    ) -> List[str]:
        """Identify potential contraindications"""
        
        contraindications = []
        
        # Standard medical disclaimers
        contraindications.extend([
            "Consult healthcare provider before making any clinical decisions",
            "Consider individual patient factors and medical history",
            "Verify drug interactions and allergies"
        ])
        
        # Extract contraindications from documents
        for doc in documents[:3]:
            content = doc.get("content", "").lower()
            
            contraindication_patterns = [
                r'contraindicated?[^.]*',
                r'not recommended[^.]*',
                r'avoid[^.]*',
                r'caution[^.]*',
                r'warning[^.]*'
            ]
            
            for pattern in contraindication_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches[:2]:  # Limit per document
                    if len(match.strip()) > 10:  # Filter out very short matches
                        contraindications.append(match.strip()[:150])
        
        return contraindications[:7]  # Limit total contraindications
    
    def _generate_follow_up_actions(
        self,
        query: str,
        documents: List[Dict],
        patient_context: Optional[Dict]
    ) -> List[str]:
        """Generate follow-up actions"""
        
        actions = [
            "Discuss findings with your primary care provider",
            "Schedule appropriate follow-up appointments",
            "Monitor for any adverse effects or changes"
        ]
        
        # Query-specific actions
        query_lower = query.lower()
        
        if any(term in query_lower for term in ["medication", "drug", "treatment"]):
            actions.extend([
                "Verify correct dosage and administration",
                "Check for drug interactions",
                "Monitor therapeutic response"
            ])
        
        if any(term in query_lower for term in ["diagnosis", "symptom", "condition"]):
            actions.extend([
                "Consider additional diagnostic tests if indicated",
                "Monitor symptom progression",
                "Seek immediate care for concerning symptoms"
            ])
        
        if any(term in query_lower for term in ["surgery", "procedure", "operation"]):
            actions.extend([
                "Discuss risks and benefits with surgeon",
                "Obtain second opinion if appropriate",
                "Review pre and post-operative care"
            ])
        
        return actions[:6]  # Limit actions
    
    def _calculate_confidence_score(
        self,
        evidence_analysis: Dict,
        documents: List[Dict]
    ) -> float:
        """Calculate confidence score for recommendations"""
        
        base_score = 0.3  # Minimum confidence
        
        # Evidence quality contribution (40% of score)
        evidence_scores = {
            "High": 0.4,
            "Moderate": 0.3, 
            "Low": 0.2,
            "Very Low": 0.1
        }
        score = base_score + evidence_scores.get(evidence_analysis["level"], 0.1)
        
        # Number of documents contribution (30% of score)
        doc_count = len(documents)
        if doc_count >= 5:
            score += 0.3
        elif doc_count >= 3:
            score += 0.2
        elif doc_count >= 1:
            score += 0.1
        
        # Recency contribution (20% of score)
        recent_ratio = evidence_analysis.get("recent_papers", 0) / max(evidence_analysis.get("total_papers", 1), 1)
        score += recent_ratio * 0.2
        
        # High impact journals contribution (10% of score)
        high_impact_ratio = evidence_analysis.get("high_impact_journals", 0) / max(evidence_analysis.get("total_papers", 1), 1)
        score += high_impact_ratio * 0.1
        
        return min(score, 0.95)  # Cap at 95% to acknowledge uncertainty