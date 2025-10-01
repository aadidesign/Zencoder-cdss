#!/usr/bin/env python3
"""
Clinical Decision Support System Launcher
Comprehensive startup and verification script
"""

import os
import sys
import subprocess
import time
import requests
import json
import logging
from pathlib import Path
import argparse
import signal
from typing import Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CDSSLauncher:
    def __init__(self, environment='development'):
        self.environment = environment
        self.base_dir = Path(__file__).parent
        self.docker_compose_file = 'docker-compose.yml' if environment == 'development' else 'docker-compose.prod.yml'
        self.services_started = False
        self.process = None
        
    def check_docker(self):
        """Check if Docker and Docker Compose are available"""
        try:
            subprocess.run(['docker', '--version'], check=True, capture_output=True)
            subprocess.run(['docker-compose', '--version'], check=True, capture_output=True)
            logger.info("✅ Docker and Docker Compose are available")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("❌ Docker or Docker Compose not found. Please install Docker Desktop.")
            return False
    
    def check_environment_file(self):
        """Check if environment file exists"""
        env_file = self.base_dir / 'backend' / '.env'
        if not env_file.exists():
            logger.warning("⚠️  Environment file not found. Creating from template...")
            env_example = self.base_dir / 'backend' / '.env.example'
            if env_example.exists():
                import shutil
                shutil.copy(env_example, env_file)
                logger.info("✅ Environment file created. Please update with your API keys.")
            else:
                logger.error("❌ No environment template found")
                return False
        return True
    
    def stop_existing_services(self):
        """Stop any existing CDSS services"""
        try:
            logger.info("🛑 Stopping existing services...")
            subprocess.run([
                'docker-compose', '-f', self.docker_compose_file, 'down'
            ], cwd=self.base_dir, capture_output=True)
            logger.info("✅ Existing services stopped")
        except subprocess.CalledProcessError as e:
            logger.warning(f"⚠️  Could not stop existing services: {e}")
    
    def start_services(self, build=True):
        """Start all CDSS services"""
        try:
            logger.info("🚀 Starting Clinical Decision Support System...")
            
            cmd = ['docker-compose', '-f', self.docker_compose_file, 'up']
            if build:
                cmd.append('--build')
            cmd.extend(['-d'])  # Detached mode
            
            self.process = subprocess.run(cmd, cwd=self.base_dir, check=True)
            self.services_started = True
            
            logger.info("✅ Services started successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Failed to start services: {e}")
            return False
    
    def wait_for_health(self, max_wait=120):
        """Wait for all services to be healthy"""
        logger.info("🔍 Waiting for services to be healthy...")
        
        health_url = "http://localhost:8000/health"
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            try:
                response = requests.get(health_url, timeout=5)
                if response.status_code == 200:
                    health_data = response.json()
                    if health_data.get('status') == 'healthy':
                        logger.info("✅ All services are healthy!")
                        return True
            except requests.RequestException:
                pass
            
            logger.info("⏳ Waiting for services to start...")
            time.sleep(5)
        
        logger.error("❌ Services did not become healthy within the timeout period")
        return False
    
    def verify_frontend(self):
        """Verify frontend is accessible"""
        try:
            response = requests.get("http://localhost:3000", timeout=10)
            if response.status_code == 200:
                logger.info("✅ Frontend is accessible at http://localhost:3000")
                return True
            else:
                logger.error(f"❌ Frontend returned status {response.status_code}")
                return False
        except requests.RequestException as e:
            logger.error(f"❌ Frontend is not accessible: {e}")
            return False
    
    def run_quick_test(self):
        """Run a quick system test"""
        logger.info("🧪 Running quick system test...")
        
        try:
            # Test health endpoint
            response = requests.get("http://localhost:8000/health", timeout=10)
            if response.status_code != 200:
                logger.error("❌ Health check failed")
                return False
            
            # Test basic API endpoint
            response = requests.get("http://localhost:8000/api/system-stats", timeout=10)
            if response.status_code != 200:
                logger.warning("⚠️  System stats endpoint not responding")
            
            logger.info("✅ Quick test passed")
            return True
            
        except requests.RequestException as e:
            logger.error(f"❌ Quick test failed: {e}")
            return False
    
    def show_system_info(self):
        """Display system information and access URLs"""
        print("\n" + "="*80)
        print("🏥 CLINICAL DECISION SUPPORT SYSTEM - READY")
        print("="*80)
        print("\n🌐 ACCESS POINTS:")
        print("  • Frontend Application: http://localhost:3000")
        print("  • Backend API: http://localhost:8000")
        print("  • API Documentation: http://localhost:8000/docs")
        print("  • Health Check: http://localhost:8000/health")
        
        if self.environment == 'production':
            print("  • Grafana Dashboard: http://localhost:3001")
            print("  • Prometheus Metrics: http://localhost:9090")
        
        print("\n📊 SYSTEM STATUS:")
        try:
            response = requests.get("http://localhost:8000/health", timeout=5)
            if response.status_code == 200:
                health_data = response.json()
                services = health_data.get('services', {})
                for service, status in services.items():
                    status_icon = "✅" if status == 'healthy' else "❌"
                    print(f"  {status_icon} {service.title()}: {status}")
        except:
            print("  ⚠️  Could not retrieve system status")
        
        print("\n🔧 MANAGEMENT COMMANDS:")
        print("  • View logs: docker-compose logs -f")
        print("  • Stop system: docker-compose down")
        print("  • Restart: docker-compose restart")
        print("  • Run tests: python test_system.py")
        
        print("\n💡 NEXT STEPS:")
        print("  1. Open http://localhost:3000 in your browser")
        print("  2. Try a clinical query like 'Treatment for acute myocardial infarction'")
        print("  3. Check the real-time processing updates")
        print("  4. Review the API documentation at http://localhost:8000/docs")
        
        print("\n" + "="*80)
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            logger.info("🛑 Received shutdown signal. Stopping services...")
            self.stop_existing_services()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def launch(self, build=True, run_tests=False, wait_for_health=True):
        """Complete launch process"""
        logger.info(f"🏥 Launching Clinical Decision Support System ({self.environment})")
        
        # Pre-flight checks
        if not self.check_docker():
            return False
        
        if not self.check_environment_file():
            return False
        
        # Setup signal handlers
        self.setup_signal_handlers()
        
        # Stop any existing services
        self.stop_existing_services()
        
        # Start services
        if not self.start_services(build=build):
            return False
        
        # Wait for health check
        if wait_for_health and not self.wait_for_health():
            return False
        
        # Verify frontend
        if not self.verify_frontend():
            logger.warning("⚠️  Frontend verification failed, but continuing...")
        
        # Run quick test
        if not self.run_quick_test():
            logger.warning("⚠️  Quick test failed, but system may still be functional")
        
        # Show system information
        self.show_system_info()
        
        # Run comprehensive tests if requested
        if run_tests:
            logger.info("🧪 Running comprehensive system tests...")
            try:
                subprocess.run([sys.executable, "test_system.py"], cwd=self.base_dir, check=True)
            except subprocess.CalledProcessError:
                logger.warning("⚠️  Some tests failed, but system is running")
        
        return True

def main():
    parser = argparse.ArgumentParser(description='CDSS System Launcher')
    parser.add_argument('--env', choices=['development', 'production'], 
                       default='development', help='Environment to launch')
    parser.add_argument('--no-build', action='store_true', 
                       help='Skip building Docker images')
    parser.add_argument('--test', action='store_true', 
                       help='Run comprehensive tests after launch')
    parser.add_argument('--no-health-check', action='store_true', 
                       help='Skip waiting for health check')
    
    args = parser.parse_args()
    
    launcher = CDSSLauncher(environment=args.env)
    
    try:
        success = launcher.launch(
            build=not args.no_build,
            run_tests=args.test,
            wait_for_health=not args.no_health_check
        )
        
        if success:
            logger.info("🎉 CDSS launched successfully!")
            
            if args.env == 'development':
                logger.info("💻 Development mode - Press Ctrl+C to stop")
                try:
                    while True:
                        time.sleep(1)
                except KeyboardInterrupt:
                    logger.info("🛑 Shutting down...")
                    launcher.stop_existing_services()
        else:
            logger.error("❌ Failed to launch CDSS")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()