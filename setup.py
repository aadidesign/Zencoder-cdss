#!/usr/bin/env python3
"""
Clinical Decision Support System Setup Script
Production-ready deployment automation
"""

import os
import sys
import subprocess
import json
import shutil
from pathlib import Path
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CDSSSetup:
    def __init__(self, environment='development'):
        self.environment = environment
        self.base_dir = Path(__file__).parent
        self.backend_dir = self.base_dir / 'backend'
        self.frontend_dir = self.base_dir / 'frontend'
        
    def check_prerequisites(self):
        """Check if all required tools are installed"""
        logger.info("Checking prerequisites...")
        
        required_tools = {
            'docker': 'Docker is required for containerization',
            'docker-compose': 'Docker Compose is required for orchestration',
            'python': 'Python 3.9+ is required',
            'node': 'Node.js 16+ is required',
            'npm': 'NPM is required for frontend dependencies'
        }
        
        missing_tools = []
        
        for tool, description in required_tools.items():
            if not self._command_exists(tool):
                missing_tools.append(f"{tool}: {description}")
        
        if missing_tools:
            logger.error("Missing required tools:")
            for tool in missing_tools:
                logger.error(f"  - {tool}")
            return False
        
        logger.info("All prerequisites met ✓")
        return True
    
    def _command_exists(self, command):
        """Check if a command exists in PATH"""
        return shutil.which(command) is not None
    
    def setup_environment(self):
        """Set up environment variables and configuration"""
        logger.info("Setting up environment configuration...")
        
        env_file = self.backend_dir / '.env'
        env_example = self.backend_dir / '.env.example'
        
        if not env_file.exists() and env_example.exists():
            shutil.copy(env_example, env_file)
            logger.info(f"Created {env_file} from template")
            logger.warning("Please edit backend/.env with your API keys and configuration")
        
        # Create necessary directories
        directories = [
            self.base_dir / 'data',
            self.base_dir / 'data' / 'vector_db',
            self.base_dir / 'logs',
            self.base_dir / 'models'
        ]
        
        for directory in directories:
            directory.mkdir(exist_ok=True)
            logger.info(f"Created directory: {directory}")
    
    def install_backend_dependencies(self):
        """Install Python backend dependencies"""
        logger.info("Installing backend dependencies...")
        
        try:
            # Check if virtual environment exists
            venv_dir = self.backend_dir / 'venv'
            
            if not venv_dir.exists():
                logger.info("Creating virtual environment...")
                subprocess.run([sys.executable, '-m', 'venv', str(venv_dir)], 
                             check=True, cwd=self.backend_dir)
            
            # Determine pip path
            if sys.platform == 'win32':
                pip_path = venv_dir / 'Scripts' / 'pip.exe'
                python_path = venv_dir / 'Scripts' / 'python.exe'
            else:
                pip_path = venv_dir / 'bin' / 'pip'
                python_path = venv_dir / 'bin' / 'python'
            
            # Install dependencies
            requirements_file = self.backend_dir / 'requirements.txt'
            if requirements_file.exists():
                logger.info("Installing Python packages...")
                subprocess.run([str(pip_path), 'install', '-r', str(requirements_file)], 
                             check=True)
                logger.info("Backend dependencies installed ✓")
            else:
                logger.error("requirements.txt not found!")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install backend dependencies: {e}")
            return False
        
        return True
    
    def install_frontend_dependencies(self):
        """Install Node.js frontend dependencies"""
        logger.info("Installing frontend dependencies...")
        
        try:
            package_json = self.frontend_dir / 'package.json'
            if package_json.exists():
                logger.info("Installing NPM packages...")
                subprocess.run(['npm', 'install'], check=True, cwd=self.frontend_dir)
                logger.info("Frontend dependencies installed ✓")
            else:
                logger.error("package.json not found!")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install frontend dependencies: {e}")
            return False
        
        return True
    
    def download_models(self):
        """Download required AI models"""
        logger.info("Downloading AI models...")
        
        try:
            # This would typically download PubMedBERT and other models
            # For now, we'll create a placeholder script
            download_script = self.base_dir / 'download_models.py'
            
            model_download_code = '''
import os
from transformers import AutoModel, AutoTokenizer
from sentence_transformers import SentenceTransformer

def download_models():
    """Download required models for the CDSS system"""
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    
    print("Downloading PubMedBERT...")
    try:
        model_name = "microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext"
        tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=models_dir)
        model = AutoModel.from_pretrained(model_name, cache_dir=models_dir)
        print("PubMedBERT downloaded successfully")
    except Exception as e:
        print(f"Failed to download PubMedBERT: {e}")
    
    print("Downloading Sentence Transformer...")
    try:
        sentence_model = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=models_dir)
        print("Sentence Transformer downloaded successfully")
    except Exception as e:
        print(f"Failed to download Sentence Transformer: {e}")

if __name__ == "__main__":
    download_models()
'''
            
            with open(download_script, 'w') as f:
                f.write(model_download_code)
            
            logger.info("Model download script created")
            logger.info("Run 'python download_models.py' to download AI models")
            
        except Exception as e:
            logger.error(f"Failed to create model download script: {e}")
            return False
        
        return True
    
    def build_docker_images(self):
        """Build Docker images for production"""
        logger.info("Building Docker images...")
        
        try:
            if self.environment == 'production':
                compose_file = 'docker-compose.prod.yml'
            else:
                compose_file = 'docker-compose.yml'
            
            subprocess.run(['docker-compose', '-f', compose_file, 'build'], 
                         check=True, cwd=self.base_dir)
            logger.info("Docker images built successfully ✓")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to build Docker images: {e}")
            return False
        
        return True
    
    def run_tests(self):
        """Run comprehensive tests"""
        logger.info("Running tests...")
        
        # Backend tests
        try:
            if (self.backend_dir / 'tests').exists():
                logger.info("Running backend tests...")
                subprocess.run(['python', '-m', 'pytest', 'tests/'], 
                             check=True, cwd=self.backend_dir)
                logger.info("Backend tests passed ✓")
        except subprocess.CalledProcessError as e:
            logger.warning(f"Backend tests failed: {e}")
        
        # Frontend tests
        try:
            if (self.frontend_dir / 'src' / '__tests__').exists():
                logger.info("Running frontend tests...")
                subprocess.run(['npm', 'test', '--', '--watchAll=false'], 
                             check=True, cwd=self.frontend_dir)
                logger.info("Frontend tests passed ✓")
        except subprocess.CalledProcessError as e:
            logger.warning(f"Frontend tests failed: {e}")
    
    def start_services(self):
        """Start all services"""
        logger.info("Starting CDSS services...")
        
        try:
            if self.environment == 'production':
                compose_file = 'docker-compose.prod.yml'
            else:
                compose_file = 'docker-compose.yml'
            
            subprocess.run(['docker-compose', '-f', compose_file, 'up', '-d'], 
                         check=True, cwd=self.base_dir)
            
            logger.info("🏥 CDSS services started successfully!")
            logger.info("Frontend: http://localhost:3000")
            logger.info("Backend API: http://localhost:8000")
            logger.info("API Docs: http://localhost:8000/docs")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to start services: {e}")
            return False
        
        return True
    
    def setup_complete(self):
        """Complete setup process"""
        if not self.check_prerequisites():
            return False
        
        self.setup_environment()
        
        if self.environment == 'development':
            if not self.install_backend_dependencies():
                return False
            if not self.install_frontend_dependencies():
                return False
        
        self.download_models()
        
        if not self.build_docker_images():
            return False
        
        if self.environment == 'development':
            self.run_tests()
        
        return self.start_services()

def main():
    parser = argparse.ArgumentParser(description='CDSS Setup Script')
    parser.add_argument('--env', choices=['development', 'production'], 
                       default='development', help='Environment to set up')
    parser.add_argument('--skip-deps', action='store_true', 
                       help='Skip dependency installation')
    parser.add_argument('--skip-build', action='store_true', 
                       help='Skip Docker build')
    parser.add_argument('--skip-tests', action='store_true', 
                       help='Skip running tests')
    
    args = parser.parse_args()
    
    setup = CDSSSetup(environment=args.env)
    
    logger.info(f"🏥 Setting up Clinical Decision Support System ({args.env})")
    
    if setup.setup_complete():
        logger.info("🎉 Setup completed successfully!")
        logger.info("Your Clinical Decision Support System is ready to use.")
    else:
        logger.error("❌ Setup failed. Please check the logs above.")
        sys.exit(1)

if __name__ == '__main__':
    main()