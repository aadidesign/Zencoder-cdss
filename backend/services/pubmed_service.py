"""
PubMed API Service for fetching research papers
"""

import asyncio
import aiohttp
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from urllib.parse import quote
import xml.etree.ElementTree as ET
from loguru import logger

from utils.config import settings


class PubMedService:
    """Service for interacting with PubMed APIs"""
    
    def __init__(self):
        self.base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        self.search_url = f"{self.base_url}/esearch.fcgi"
        self.fetch_url = f"{self.base_url}/efetch.fcgi"
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def search_recent_papers(
        self,
        search_terms: List[str],
        limit: int = 20,
        days_back: int = 30
    ) -> List[Dict]:
        """Search for recent papers on PubMed"""
        
        logger.info(f"Searching PubMed for: {search_terms}")
        
        try:
            # Build search query
            query_string = " AND ".join([f'"{term}"' for term in search_terms])
            
            # Add date filter for recent papers
            date_filter = (datetime.now() - timedelta(days=days_back)).strftime("%Y/%m/%d")
            query_string += f" AND {date_filter}[PDAT]:3000[PDAT]"  # From date_filter to future
            
            # Search for PMIDs
            pmids = await self._search_pmids(query_string, limit)
            
            if not pmids:
                logger.warning("No PMIDs found for query")
                return []
            
            # Fetch paper details
            papers = await self._fetch_paper_details(pmids)
            
            logger.info(f"Retrieved {len(papers)} papers from PubMed")
            return papers
            
        except Exception as e:
            logger.error(f"Error searching PubMed: {e}")
            return []
    
    async def _search_pmids(self, query: str, limit: int) -> List[str]:
        """Search for PMIDs using esearch"""
        
        params = {
            "db": "pubmed",
            "term": query,
            "retmode": "xml",
            "retmax": str(limit),
            "sort": "relevance",
            "email": settings.PUBMED_EMAIL,
        }
        
        if settings.PUBMED_API_KEY:
            params["api_key"] = settings.PUBMED_API_KEY
        
        session = await self._get_session()
        
        try:
            async with session.get(self.search_url, params=params) as response:
                if response.status != 200:
                    logger.error(f"PubMed search failed with status: {response.status}")
                    return []
                
                xml_content = await response.text()
                root = ET.fromstring(xml_content)
                
                # Extract PMIDs
                pmids = []
                for pmid_elem in root.findall(".//Id"):
                    pmids.append(pmid_elem.text)
                
                return pmids
                
        except Exception as e:
            logger.error(f"Error in PMID search: {e}")
            return []
    
    async def _fetch_paper_details(self, pmids: List[str]) -> List[Dict]:
        """Fetch detailed paper information using efetch"""
        
        if not pmids:
            return []
        
        # Process in batches to avoid overwhelming the API
        batch_size = 10
        all_papers = []
        
        for i in range(0, len(pmids), batch_size):
            batch_pmids = pmids[i:i + batch_size]
            batch_papers = await self._fetch_batch_details(batch_pmids)
            all_papers.extend(batch_papers)
            
            # Rate limiting - be respectful to NCBI
            if i + batch_size < len(pmids):
                await asyncio.sleep(0.5)
        
        return all_papers
    
    async def _fetch_batch_details(self, pmids: List[str]) -> List[Dict]:
        """Fetch details for a batch of PMIDs"""
        
        params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml",
            "rettype": "abstract",
            "email": settings.PUBMED_EMAIL,
        }
        
        if settings.PUBMED_API_KEY:
            params["api_key"] = settings.PUBMED_API_KEY
        
        session = await self._get_session()
        
        try:
            async with session.get(self.fetch_url, params=params) as response:
                if response.status != 200:
                    logger.error(f"PubMed fetch failed with status: {response.status}")
                    return []
                
                xml_content = await response.text()
                return self._parse_pubmed_xml(xml_content)
                
        except Exception as e:
            logger.error(f"Error fetching paper details: {e}")
            return []
    
    def _parse_pubmed_xml(self, xml_content: str) -> List[Dict]:
        """Parse PubMed XML response"""
        
        papers = []
        
        try:
            root = ET.fromstring(xml_content)
            
            for article in root.findall(".//PubmedArticle"):
                paper = self._extract_paper_data(article)
                if paper:
                    papers.append(paper)
        
        except Exception as e:
            logger.error(f"Error parsing PubMed XML: {e}")
        
        return papers
    
    def _extract_paper_data(self, article_elem) -> Optional[Dict]:
        """Extract paper data from XML element"""
        
        try:
            # PMID
            pmid_elem = article_elem.find(".//PMID")
            pmid = pmid_elem.text if pmid_elem is not None else ""
            
            if not pmid:
                return None
            
            # Title
            title_elem = article_elem.find(".//ArticleTitle")
            title = title_elem.text if title_elem is not None else ""
            
            # Abstract
            abstract_parts = []
            for abstract_elem in article_elem.findall(".//AbstractText"):
                if abstract_elem.text:
                    label = abstract_elem.get("Label", "")
                    if label:
                        abstract_parts.append(f"{label}: {abstract_elem.text}")
                    else:
                        abstract_parts.append(abstract_elem.text)
            
            abstract = " ".join(abstract_parts)
            
            # Authors
            authors = []
            for author_elem in article_elem.findall(".//Author"):
                last_name = author_elem.find("LastName")
                first_name = author_elem.find("ForeName")
                if last_name is not None:
                    author_name = last_name.text or ""
                    if first_name is not None and first_name.text:
                        author_name += f", {first_name.text}"
                    authors.append(author_name)
            
            # Journal
            journal_elem = article_elem.find(".//Journal/Title")
            journal = journal_elem.text if journal_elem is not None else ""
            
            # Publication date
            pub_date_elem = article_elem.find(".//PubDate")
            pub_date = ""
            if pub_date_elem is not None:
                year = pub_date_elem.find("Year")
                month = pub_date_elem.find("Month")
                day = pub_date_elem.find("Day")
                
                if year is not None:
                    pub_date = year.text
                    if month is not None:
                        pub_date += f"-{month.text}"
                        if day is not None:
                            pub_date += f"-{day.text}"
            
            # Keywords
            keywords = []
            for keyword_elem in article_elem.findall(".//Keyword"):
                if keyword_elem.text:
                    keywords.append(keyword_elem.text)
            
            # MeSH terms
            mesh_terms = []
            for mesh_elem in article_elem.findall(".//MeshHeading/DescriptorName"):
                if mesh_elem.text:
                    mesh_terms.append(mesh_elem.text)
            
            return {
                "pmid": pmid,
                "title": title,
                "abstract": abstract,
                "authors": authors,
                "journal": journal,
                "pub_date": pub_date,
                "keywords": keywords,
                "mesh_terms": mesh_terms,
                "full_text": f"{title} {abstract}",
                "source": "pubmed",
                "retrieved_at": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error extracting paper data: {e}")
            return None
    
    async def close(self):
        """Close the session"""
        if self.session and not self.session.closed:
            await self.session.close()