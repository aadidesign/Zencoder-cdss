#!/usr/bin/env python3
"""
Comprehensive system test for Clinical Decision Support System
Tests all major components and integrations
"""

import asyncio
import json
import requests
import websockets
import time
import logging
from typing import Dict, List, Any
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CDSSSystemTest:
    def __init__(self, base_url: str = "http://localhost:8000", ws_url: str = "ws://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.ws_url = ws_url.rstrip('/')
        self.session = requests.Session()
        self.test_results = []
        
    def add_test_result(self, test_name: str, success: bool, message: str, duration: float = 0):
        """Add a test result to the results list"""
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'duration': duration
        })
        
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} {test_name}: {message} ({duration:.2f}s)")
    
    def test_health_endpoint(self):
        """Test system health endpoint"""
        start_time = time.time()
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get('status') == 'healthy':
                    self.add_test_result(
                        "Health Check", 
                        True, 
                        f"System is healthy. Services: {', '.join(health_data.get('services', {}).keys())}", 
                        duration
                    )
                    return True
                else:
                    self.add_test_result("Health Check", False, f"System unhealthy: {health_data}", duration)
                    return False
            else:
                self.add_test_result("Health Check", False, f"HTTP {response.status_code}", duration)
                return False
                
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("Health Check", False, f"Connection failed: {str(e)}", duration)
            return False
    
    def test_api_endpoints(self):
        """Test main API endpoints"""
        endpoints = [
            ("/api/system-stats", "GET", "System Stats"),
            ("/api/recent-papers", "GET", "Recent Papers"),
        ]
        
        all_passed = True
        for endpoint, method, name in endpoints:
            start_time = time.time()
            try:
                response = self.session.request(method, f"{self.base_url}{endpoint}", timeout=30)
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    self.add_test_result(f"API {name}", True, f"Endpoint responsive", duration)
                else:
                    self.add_test_result(f"API {name}", False, f"HTTP {response.status_code}", duration)
                    all_passed = False
                    
            except Exception as e:
                duration = time.time() - start_time
                self.add_test_result(f"API {name}", False, f"Request failed: {str(e)}", duration)
                all_passed = False
        
        return all_passed
    
    async def test_websocket_connection(self):
        """Test WebSocket connection and basic messaging"""
        start_time = time.time()
        try:
            async with websockets.connect(f"{self.ws_url}/ws", ping_interval=None) as websocket:
                duration = time.time() - start_time
                self.add_test_result("WebSocket Connection", True, "Connection established", duration)
                
                # Test sending a ping message
                test_message = {"type": "ping", "data": "test"}
                await websocket.send(json.dumps(test_message))
                
                # Wait for response
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    self.add_test_result("WebSocket Messaging", True, "Message exchange successful", 0)
                    return True
                except asyncio.TimeoutError:
                    self.add_test_result("WebSocket Messaging", False, "No response received", 0)
                    return False
                    
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("WebSocket Connection", False, f"Connection failed: {str(e)}", duration)
            return False
    
    def test_clinical_query(self):
        """Test clinical query processing"""
        start_time = time.time()
        
        test_query = {
            "query": "What are the latest treatments for acute myocardial infarction?",
            "patient_context": {
                "age": 65,
                "gender": "male",
                "conditions": ["hypertension", "diabetes"],
                "medications": ["metformin", "lisinopril"]
            }
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/clinical-query",
                json=test_query,
                timeout=120  # Clinical queries can take longer
            )
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                if result.get('recommendations'):
                    self.add_test_result(
                        "Clinical Query", 
                        True, 
                        f"Query processed successfully. {len(result.get('recommendations', []))} recommendations", 
                        duration
                    )
                    return True
                else:
                    self.add_test_result("Clinical Query", False, "No recommendations returned", duration)
                    return False
            else:
                self.add_test_result("Clinical Query", False, f"HTTP {response.status_code}: {response.text}", duration)
                return False
                
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("Clinical Query", False, f"Query failed: {str(e)}", duration)
            return False
    
    async def test_realtime_clinical_processing(self):
        """Test real-time clinical query processing via WebSocket"""
        start_time = time.time()
        
        test_query = {
            "type": "clinical_query",
            "data": {
                "query": "Treatment options for type 2 diabetes in elderly patients",
                "patient_context": {
                    "age": 72,
                    "gender": "female",
                    "conditions": ["type 2 diabetes", "osteoarthritis"]
                }
            }
        }
        
        try:
            async with websockets.connect(f"{self.ws_url}/ws", ping_interval=None) as websocket:
                # Send clinical query
                await websocket.send(json.dumps(test_query))
                
                # Collect real-time updates
                updates = []
                timeout_count = 0
                max_timeouts = 3
                
                while timeout_count < max_timeouts:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                        update = json.loads(message)
                        updates.append(update)
                        
                        # Check if processing is complete
                        if update.get('type') == 'processing_complete':
                            break
                            
                        timeout_count = 0  # Reset timeout count on successful message
                        
                    except asyncio.TimeoutError:
                        timeout_count += 1
                        continue
                
                duration = time.time() - start_time
                
                if updates:
                    processing_steps = [u.get('step', 'unknown') for u in updates]
                    self.add_test_result(
                        "Real-time Processing", 
                        True, 
                        f"Received {len(updates)} updates. Steps: {', '.join(processing_steps)}", 
                        duration
                    )
                    return True
                else:
                    self.add_test_result("Real-time Processing", False, "No updates received", duration)
                    return False
                    
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("Real-time Processing", False, f"Processing failed: {str(e)}", duration)
            return False
    
    def test_pubmed_integration(self):
        """Test PubMed API integration"""
        start_time = time.time()
        
        try:
            # Test searching for recent papers
            response = self.session.get(
                f"{self.base_url}/api/recent-papers",
                params={"query": "myocardial infarction", "max_results": 5},
                timeout=30
            )
            duration = time.time() - start_time
            
            if response.status_code == 200:
                papers = response.json()
                if isinstance(papers, list) and len(papers) > 0:
                    paper_titles = [p.get('title', 'No title') for p in papers[:3]]
                    self.add_test_result(
                        "PubMed Integration", 
                        True, 
                        f"Retrieved {len(papers)} papers. Samples: {'; '.join(paper_titles)}", 
                        duration
                    )
                    return True
                else:
                    self.add_test_result("PubMed Integration", False, "No papers returned", duration)
                    return False
            else:
                self.add_test_result("PubMed Integration", False, f"HTTP {response.status_code}", duration)
                return False
                
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("PubMed Integration", False, f"PubMed test failed: {str(e)}", duration)
            return False
    
    def test_vector_database(self):
        """Test vector database operations"""
        start_time = time.time()
        
        try:
            # This would test vector database health through a dedicated endpoint
            # For now, we'll check if the service is responding
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                health_data = response.json()
                vector_db_status = health_data.get('services', {}).get('vector_db', 'unknown')
                
                if vector_db_status == 'healthy':
                    self.add_test_result("Vector Database", True, "Vector DB service healthy", duration)
                    return True
                else:
                    self.add_test_result("Vector Database", False, f"Vector DB status: {vector_db_status}", duration)
                    return False
            else:
                self.add_test_result("Vector Database", False, f"Health check failed: HTTP {response.status_code}", duration)
                return False
                
        except Exception as e:
            duration = time.time() - start_time
            self.add_test_result("Vector Database", False, f"Vector DB test failed: {str(e)}", duration)
            return False
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "="*80)
        print("🏥 CLINICAL DECISION SUPPORT SYSTEM - TEST REPORT")
        print("="*80)
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
        
        print(f"\n📊 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            duration_str = f"({result['duration']:.2f}s)" if result['duration'] > 0 else ""
            print(f"  {status} {result['test']}: {result['message']} {duration_str}")
        
        print("\n" + "="*80)
        
        return failed_tests == 0
    
    async def run_all_tests(self):
        """Run comprehensive system tests"""
        logger.info("🏥 Starting Clinical Decision Support System Tests...")
        
        # Basic connectivity tests
        logger.info("Testing basic connectivity...")
        self.test_health_endpoint()
        self.test_api_endpoints()
        
        # WebSocket tests
        logger.info("Testing WebSocket functionality...")
        await self.test_websocket_connection()
        
        # Core functionality tests
        logger.info("Testing core functionality...")
        self.test_pubmed_integration()
        self.test_vector_database()
        
        # Advanced integration tests (may take longer)
        logger.info("Testing advanced features...")
        self.test_clinical_query()
        await self.test_realtime_clinical_processing()
        
        # Print comprehensive summary
        all_passed = self.print_test_summary()
        
        return all_passed

async def main():
    """Main test execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='CDSS System Test Suite')
    parser.add_argument('--url', default='http://localhost:8000', help='Backend URL')
    parser.add_argument('--ws-url', default='ws://localhost:8000', help='WebSocket URL')
    parser.add_argument('--timeout', type=int, default=300, help='Overall test timeout in seconds')
    
    args = parser.parse_args()
    
    tester = CDSSSystemTest(base_url=args.url, ws_url=args.ws_url)
    
    try:
        all_passed = await asyncio.wait_for(tester.run_all_tests(), timeout=args.timeout)
        
        if all_passed:
            logger.info("🎉 All tests passed! CDSS system is functioning correctly.")
            sys.exit(0)
        else:
            logger.error("❌ Some tests failed. Please check the system.")
            sys.exit(1)
            
    except asyncio.TimeoutError:
        logger.error(f"⏰ Tests timed out after {args.timeout} seconds")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("🛑 Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Test suite failed with error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())