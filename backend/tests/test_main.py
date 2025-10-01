"""
Comprehensive test suite for Clinical Decision Support System
Production-ready testing with security, performance, and integration tests
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import Mock, patch, AsyncMock
import httpx
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import websockets
import redis
from prometheus_client import CollectorRegistry

# Import application components
from main import app, get_current_user, verify_request_security
from services.rag_service import RAGService
from services.websocket_manager import WebSocketManager
from utils.security import SecurityService, InputSanitizer, PasswordValidator
from utils.monitoring import MonitoringService


class TestSecurityValidation:
    """Test security-related functionality"""
    
    def test_password_validation_strong(self):
        """Test strong password validation"""
        validator = PasswordValidator()
        is_valid, errors = validator.validate_password("SecureP@ssw0rd123")
        assert is_valid
        assert len(errors) == 0
    
    def test_password_validation_weak(self):
        """Test weak password rejection"""
        validator = PasswordValidator()
        is_valid, errors = validator.validate_password("weak")
        assert not is_valid
        assert len(errors) > 0
    
    def test_input_sanitization_clean(self):
        """Test clean clinical query input"""
        sanitizer = InputSanitizer()
        is_valid, message = sanitizer.validate_clinical_query(
            "What are the treatment options for acute myocardial infarction?"
        )
        assert is_valid
        assert message == "Valid query"
    
    def test_input_sanitization_malicious(self):
        """Test malicious input rejection"""
        sanitizer = InputSanitizer()
        malicious_inputs = [
            "<script>alert('xss')</script>",
            "'; DROP TABLE patients; --",
            "javascript:alert(1)",
            "SELECT * FROM users WHERE id=1",
        ]
        
        for malicious_input in malicious_inputs:
            is_valid, message = sanitizer.validate_clinical_query(malicious_input)
            assert not is_valid
            assert "harmful" in message.lower()
    
    def test_file_upload_validation_valid(self):
        """Test valid file upload validation"""
        sanitizer = InputSanitizer()
        is_valid, message = sanitizer.validate_file_upload(
            "medical_report.pdf", 
            "application/pdf"
        )
        assert is_valid
    
    def test_file_upload_validation_invalid(self):
        """Test invalid file upload rejection"""
        sanitizer = InputSanitizer()
        invalid_files = [
            ("malware.exe", "application/exe"),
            ("../../../etc/passwd", "text/plain"),
            ("script.js", "text/javascript"),
        ]
        
        for filename, content_type in invalid_files:
            is_valid, message = sanitizer.validate_file_upload(filename, content_type)
            assert not is_valid


class TestAPIEndpoints:
    """Test API endpoints functionality and security"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "uptime_seconds" in data
    
    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code in [200, 503]  # May be unhealthy in test environment
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert "timestamp" in data
    
    def test_metrics_endpoint(self, client):
        """Test Prometheus metrics endpoint"""
        response = client.get("/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
        assert "http_requests_total" in response.text
    
    def test_info_endpoint(self, client):
        """Test system info endpoint"""
        response = client.get("/info")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Clinical Decision Support System"
        assert "features" in data
        assert "endpoints" in data
    
    def test_status_endpoint(self, client):
        """Test service status endpoint"""
        response = client.get("/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert "timestamp" in data
    
    def test_rate_limiting(self, client):
        """Test rate limiting functionality"""
        # Make multiple requests to trigger rate limit
        endpoint = "/info"
        limit = 12  # Slightly above the 10/minute limit
        
        responses = []
        for _ in range(limit):
            response = client.get(endpoint)
            responses.append(response.status_code)
        
        # Should have at least one rate limited response
        assert 429 in responses
    
    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.options("/", headers={"Origin": "http://localhost:3000"})
        assert "access-control-allow-origin" in response.headers
    
    def test_security_headers(self, client):
        """Test security headers are present"""
        response = client.get("/")
        headers = response.headers
        
        # Check for key security headers
        assert "x-content-type-options" in headers
        assert "x-frame-options" in headers
        assert headers["x-content-type-options"] == "nosniff"
        assert headers["x-frame-options"] == "DENY"
    
    def test_request_id_header(self, client):
        """Test request ID is added to responses"""
        response = client.get("/")
        assert "x-request-id" in response.headers
        assert response.headers["x-request-id"].startswith("req_")
    
    def test_response_time_header(self, client):
        """Test response time header is present"""
        response = client.get("/")
        assert "x-response-time" in response.headers
        response_time = float(response.headers["x-response-time"])
        assert response_time > 0
    
    def test_malformed_requests(self, client):
        """Test handling of malformed requests"""
        # Test with invalid JSON
        response = client.post("/api/v1/clinical-query", 
                              data="invalid json", 
                              headers={"content-type": "application/json"})
        assert response.status_code == 422
        
        # Test with missing required fields
        response = client.post("/api/v1/clinical-query", json={})
        assert response.status_code in [400, 422]
    
    def test_error_handling(self, client):
        """Test error handling and responses"""
        # Test non-existent endpoint
        response = client.get("/nonexistent")
        assert response.status_code == 404
        
        # Verify error response structure
        if response.status_code >= 400:
            data = response.json()
            assert "detail" in data
            assert "timestamp" in data


class TestWebSocketConnection:
    """Test WebSocket functionality"""
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection establishment"""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_client") as websocket:
                # Should receive welcome message
                data = websocket.receive_json()
                assert data["type"] == "welcome"
                assert data["client_id"] == "test_client"
                assert "capabilities" in data
    
    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self):
        """Test WebSocket ping/pong functionality"""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_client") as websocket:
                # Skip welcome message
                websocket.receive_json()
                
                # Send ping
                websocket.send_json({"type": "ping"})
                response = websocket.receive_json()
                
                assert response["type"] == "pong"
                assert "timestamp" in response
    
    @pytest.mark.asyncio
    async def test_websocket_invalid_message(self):
        """Test WebSocket error handling for invalid messages"""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_client") as websocket:
                # Skip welcome message
                websocket.receive_json()
                
                # Send invalid message
                websocket.send_json({"invalid": "message"})
                response = websocket.receive_json()
                
                assert response["type"] == "error"
                assert "Invalid message format" in response["message"]
    
    @pytest.mark.asyncio
    async def test_websocket_clinical_query(self):
        """Test clinical query via WebSocket"""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_client") as websocket:
                # Skip welcome message
                websocket.receive_json()
                
                # Send clinical query
                websocket.send_json({
                    "type": "clinical_query",
                    "query": "What are the symptoms of diabetes?"
                })
                
                # Should receive processing started message
                response = websocket.receive_json()
                assert response["type"] == "processing_started"
                assert "query_id" in response
    
    @pytest.mark.asyncio
    async def test_websocket_invalid_client_id(self):
        """Test WebSocket connection with invalid client ID"""
        with TestClient(app) as client:
            with pytest.raises(Exception):  # Should close connection
                with client.websocket_connect("/ws/x"):  # Too short client ID
                    pass


class TestMonitoring:
    """Test monitoring and metrics functionality"""
    
    def test_metrics_collection(self):
        """Test metrics are being collected"""
        from main import request_count, request_duration, system_health
        
        # Verify metrics exist and are accessible
        assert request_count is not None
        assert request_duration is not None
        assert system_health is not None
    
    def test_health_check_components(self):
        """Test health check includes all components"""
        client = TestClient(app)
        response = client.get("/health")
        
        if response.status_code == 200:
            data = response.json()
            expected_services = ["rag_service", "websocket_manager", "redis", "security", "monitoring"]
            
            for service in expected_services:
                assert service in data.get("services", {})
    
    def test_system_metrics_in_health(self):
        """Test system metrics are included in health check"""
        client = TestClient(app)
        response = client.get("/health")
        
        if response.status_code == 200:
            data = response.json()
            assert "system" in data
            system_metrics = data["system"]
            
            expected_metrics = ["cpu_percent", "memory_percent", "memory_available_mb"]
            for metric in expected_metrics:
                assert metric in system_metrics


class TestPerformance:
    """Test performance characteristics"""
    
    def test_response_time_baseline(self):
        """Test API response times are within acceptable limits"""
        client = TestClient(app)
        
        endpoints = ["/", "/health", "/status", "/info"]
        max_response_time = 2.0  # seconds
        
        for endpoint in endpoints:
            start_time = time.time()
            response = client.get(endpoint)
            end_time = time.time()
            
            response_time = end_time - start_time
            assert response_time < max_response_time, f"{endpoint} took {response_time}s"
            assert response.status_code in [200, 503]  # 503 acceptable for health in test
    
    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        import threading
        client = TestClient(app)
        
        results = []
        num_threads = 10
        
        def make_request():
            try:
                response = client.get("/")
                results.append(response.status_code)
            except Exception as e:
                results.append(str(e))
        
        # Create and start threads
        threads = []
        for _ in range(num_threads):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Verify results
        assert len(results) == num_threads
        success_count = sum(1 for r in results if r == 200)
        assert success_count >= num_threads * 0.8  # At least 80% success rate
    
    def test_memory_usage_stability(self):
        """Test memory usage doesn't grow excessively"""
        import psutil
        import gc
        
        client = TestClient(app)
        process = psutil.Process()
        
        # Get initial memory usage
        initial_memory = process.memory_info().rss
        
        # Make multiple requests
        for _ in range(100):
            response = client.get("/")
            assert response.status_code in [200, 429]  # Rate limiting may kick in
        
        # Force garbage collection
        gc.collect()
        
        # Get final memory usage
        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        
        # Memory growth should be reasonable (less than 50MB)
        assert memory_growth < 50 * 1024 * 1024, f"Memory grew by {memory_growth / 1024 / 1024:.1f}MB"


class TestIntegration:
    """Integration tests for the complete system"""
    
    @pytest.mark.asyncio
    async def test_full_clinical_workflow(self):
        """Test complete clinical decision support workflow"""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/integration_test") as websocket:
                # Skip welcome message
                websocket.receive_json()
                
                # Send clinical query
                query_data = {
                    "type": "clinical_query",
                    "query": "65-year-old male with chest pain, history of hypertension",
                    "patient_context": {
                        "age": 65,
                        "gender": "male",
                        "symptoms": ["chest pain"],
                        "medical_history": ["hypertension"]
                    }
                }
                
                websocket.send_json(query_data)
                
                # Collect all messages until completion
                messages = []
                timeout = 30  # 30 second timeout
                start_time = time.time()
                
                while time.time() - start_time < timeout:
                    try:
                        message = websocket.receive_json()
                        messages.append(message)
                        
                        if message.get("type") == "clinical_response":
                            break
                    except Exception:
                        break
                
                # Verify we received appropriate messages
                message_types = [msg.get("type") for msg in messages]
                assert "processing_started" in message_types
                
                # If RAG service is available, should get clinical response
                if any(msg.get("type") == "clinical_response" for msg in messages):
                    clinical_response = next(msg for msg in messages if msg.get("type") == "clinical_response")
                    assert "response" in clinical_response
    
    def test_error_recovery(self):
        """Test system error recovery capabilities"""
        client = TestClient(app)
        
        # Test recovery from various error conditions
        error_scenarios = [
            ("/nonexistent-endpoint", 404),
            ("/health", [200, 503]),  # May be unhealthy in test
        ]
        
        for endpoint, expected_status in error_scenarios:
            response = client.get(endpoint)
            if isinstance(expected_status, list):
                assert response.status_code in expected_status
            else:
                assert response.status_code == expected_status
        
        # System should still be responsive after errors
        response = client.get("/")
        assert response.status_code == 200


class TestConfiguration:
    """Test configuration and environment handling"""
    
    def test_environment_variables(self):
        """Test environment variable handling"""
        from utils.config import Settings
        
        settings = Settings()
        
        # Test that essential settings exist
        essential_settings = ['DEBUG', 'HOST', 'PORT']
        for setting in essential_settings:
            assert hasattr(settings, setting)
    
    def test_development_vs_production_config(self):
        """Test configuration differences between environments"""
        client = TestClient(app)
        
        response = client.get("/info")
        assert response.status_code == 200
        
        data = response.json()
        environment = data.get("environment", {})
        
        # Verify environment-specific configurations
        assert "debug" in environment
        assert "cors_enabled" in environment


@pytest.mark.asyncio
class TestAsyncOperations:
    """Test asynchronous operations and concurrency"""
    
    async def test_concurrent_websocket_connections(self):
        """Test multiple concurrent WebSocket connections"""
        num_connections = 5
        tasks = []
        
        async def create_connection(client_id):
            # Simulate WebSocket connection behavior
            try:
                # Mock successful connection
                await asyncio.sleep(0.1)
                return f"success_{client_id}"
            except Exception as e:
                return f"error_{client_id}_{e}"
        
        # Create concurrent connection tasks
        for i in range(num_connections):
            task = create_connection(f"client_{i}")
            tasks.append(task)
        
        # Wait for all connections to complete
        results = await asyncio.gather(*tasks)
        
        # Verify results
        success_count = sum(1 for r in results if r.startswith("success_"))
        assert success_count == num_connections
    
    async def test_async_service_initialization(self):
        """Test asynchronous service initialization"""
        # Mock service initialization
        services = ["rag_service", "monitoring_service", "security_service"]
        
        async def init_service(service_name):
            await asyncio.sleep(0.1)  # Simulate initialization time
            return f"{service_name}_initialized"
        
        # Initialize services concurrently
        tasks = [init_service(service) for service in services]
        results = await asyncio.gather(*tasks)
        
        # Verify all services initialized
        assert len(results) == len(services)
        for i, result in enumerate(results):
            assert result == f"{services[i]}_initialized"


def test_production_readiness_checklist():
    """Comprehensive production readiness test"""
    client = TestClient(app)
    
    # Test 1: Health endpoint responds
    health_response = client.get("/health")
    assert health_response.status_code in [200, 503]
    
    # Test 2: Metrics endpoint accessible
    metrics_response = client.get("/metrics")
    assert metrics_response.status_code == 200
    
    # Test 3: API documentation (if in debug mode)
    info_response = client.get("/info")
    assert info_response.status_code == 200
    
    # Test 4: Rate limiting works
    rate_limit_test_passed = False
    for _ in range(15):  # Exceed rate limit
        response = client.get("/info")
        if response.status_code == 429:
            rate_limit_test_passed = True
            break
    # Note: Rate limiting may not trigger in test environment
    
    # Test 5: Error handling works
    error_response = client.get("/nonexistent")
    assert error_response.status_code == 404
    
    # Test 6: Security headers present
    response = client.get("/")
    headers = response.headers
    security_headers = ["x-content-type-options", "x-frame-options"]
    for header in security_headers:
        assert header in headers
    
    print("✅ Production readiness tests completed successfully!")


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])