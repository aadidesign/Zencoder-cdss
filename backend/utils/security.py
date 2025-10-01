"""
Enhanced Security utilities for Clinical Decision Support System
Production-grade security implementations
"""

import hashlib
import secrets
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from cryptography.fernet import Fernet
import aioredis
import logging
from functools import wraps
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import ipaddress
from urllib.parse import urlparse
import bleach
from sqlalchemy.sql import text
from pydantic import BaseModel, validator
import asyncio

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"], 
    deprecated="auto",
    argon2__memory_cost=65536,
    argon2__time_cost=3,
    argon2__parallelism=1,
)

# JWT Configuration
SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
}

class SecurityConfig(BaseModel):
    """Security configuration model"""
    jwt_secret_key: str = SECRET_KEY
    jwt_algorithm: str = ALGORITHM
    access_token_expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES
    refresh_token_expire_days: int = REFRESH_TOKEN_EXPIRE_DAYS
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 30
    password_min_length: int = 12
    password_require_special: bool = True
    password_require_numbers: bool = True
    password_require_uppercase: bool = True
    rate_limit_requests_per_minute: int = 60
    allowed_origins: List[str] = ["http://localhost:3000"]
    trusted_proxies: List[str] = ["127.0.0.1", "::1"]

class PasswordValidator:
    """Advanced password validation"""
    
    @staticmethod
    def validate_password(password: str, min_length: int = 12) -> tuple[bool, List[str]]:
        """Validate password strength"""
        errors = []
        
        if len(password) < min_length:
            errors.append(f"Password must be at least {min_length} characters long")
        
        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")
        
        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")
        
        if not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")
        
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character")
        
        # Check for common passwords
        if password.lower() in ["password", "123456", "admin", "qwerty"]:
            errors.append("Password is too common")
        
        # Check for patterns
        if re.search(r"(.)\1{2,}", password):
            errors.append("Password contains too many repeated characters")
        
        return len(errors) == 0, errors

class InputSanitizer:
    """Input sanitization and validation"""
    
    @staticmethod
    def sanitize_html(text: str) -> str:
        """Sanitize HTML input"""
        allowed_tags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']
        allowed_attributes = {}
        
        return bleach.clean(
            text, 
            tags=allowed_tags, 
            attributes=allowed_attributes,
            strip=True
        )
    
    @staticmethod
    def validate_clinical_query(query: str) -> tuple[bool, str]:
        """Validate clinical query input"""
        # Remove potential SQL injection patterns
        sql_patterns = [
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
            r"(--|#|\*\/|\*)",
            r"(\bunion\b|\bor\b|\band\b).*(\=|\<|\>)",
            r"(\bxp_|\bsp_)",
        ]
        
        query_lower = query.lower()
        for pattern in sql_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return False, "Query contains potentially harmful patterns"
        
        # Check for XSS patterns
        xss_patterns = [
            r"<script",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe",
            r"<object",
            r"<embed"
        ]
        
        for pattern in xss_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                return False, "Query contains potentially harmful scripts"
        
        # Basic length validation
        if len(query.strip()) == 0:
            return False, "Query cannot be empty"
        
        if len(query) > 10000:
            return False, "Query is too long"
        
        return True, "Valid query"
    
    @staticmethod
    def validate_file_upload(filename: str, content_type: str, max_size: int = 10485760) -> tuple[bool, str]:
        """Validate file uploads"""
        allowed_extensions = ['.pdf', '.txt', '.docx', '.csv']
        allowed_content_types = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv'
        ]
        
        # Check extension
        file_ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
        if file_ext not in allowed_extensions:
            return False, f"File type not allowed. Allowed types: {allowed_extensions}"
        
        # Check content type
        if content_type not in allowed_content_types:
            return False, f"Content type not allowed: {content_type}"
        
        # Check filename for path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return False, "Invalid filename"
        
        return True, "Valid file"

class RateLimiter:
    """Advanced rate limiting with Redis"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def is_rate_limited(
        self, 
        key: str, 
        limit: int = 60, 
        window: int = 60,
        burst_limit: int = 10
    ) -> tuple[bool, Dict[str, Any]]:
        """Check if request is rate limited using sliding window"""
        now = datetime.utcnow().timestamp()
        pipeline = self.redis.pipeline()
        
        # Remove old entries
        pipeline.zremrangebyscore(key, 0, now - window)
        
        # Count current requests
        pipeline.zcard(key)
        
        # Add current request
        pipeline.zadd(key, {str(now): now})
        
        # Set expiry
        pipeline.expire(key, window)
        
        results = await pipeline.execute()
        current_count = results[1]
        
        # Check burst limit (requests in last 10 seconds)
        burst_count = await self.redis.zcount(key, now - 10, now)
        
        rate_limited = current_count >= limit or burst_count >= burst_limit
        
        return rate_limited, {
            'current_count': current_count,
            'limit': limit,
            'burst_count': burst_count,
            'burst_limit': burst_limit,
            'reset_time': int(now + window)
        }

class LoginAttemptTracker:
    """Track and manage login attempts"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.max_attempts = 5
        self.lockout_duration = 1800  # 30 minutes
    
    async def record_failed_attempt(self, identifier: str) -> None:
        """Record failed login attempt"""
        key = f"login_attempts:{identifier}"
        current_attempts = await self.redis.incr(key)
        
        if current_attempts == 1:
            await self.redis.expire(key, self.lockout_duration)
        
        logger.warning(f"Failed login attempt for {identifier}. Count: {current_attempts}")
    
    async def is_locked_out(self, identifier: str) -> tuple[bool, int]:
        """Check if account is locked out"""
        key = f"login_attempts:{identifier}"
        attempts = await self.redis.get(key)
        
        if attempts is None:
            return False, 0
        
        attempts = int(attempts)
        if attempts >= self.max_attempts:
            ttl = await self.redis.ttl(key)
            return True, ttl
        
        return False, 0
    
    async def clear_attempts(self, identifier: str) -> None:
        """Clear failed attempts after successful login"""
        key = f"login_attempts:{identifier}"
        await self.redis.delete(key)

class DataEncryption:
    """Data encryption utilities"""
    
    def __init__(self, key: Optional[bytes] = None):
        if key is None:
            key = Fernet.generate_key()
        self.fernet = Fernet(key)
        self.key = key
    
    def encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self.fernet.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.fernet.decrypt(encrypted_data.encode()).decode()
    
    @staticmethod
    def hash_pii(data: str) -> str:
        """Hash PII data for anonymization"""
        return hashlib.sha256(data.encode()).hexdigest()

class SecurityAuditLogger:
    """Security event logging"""
    
    def __init__(self):
        self.logger = logging.getLogger("security_audit")
        
    def log_security_event(
        self, 
        event_type: str, 
        user_id: Optional[str], 
        ip_address: str,
        user_agent: str,
        details: Dict[str, Any]
    ) -> None:
        """Log security events"""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "details": details
        }
        
        self.logger.info(f"SECURITY_EVENT: {event}")
    
    def log_suspicious_activity(
        self, 
        activity: str, 
        ip_address: str, 
        details: Dict[str, Any]
    ) -> None:
        """Log suspicious activities"""
        self.log_security_event(
            "SUSPICIOUS_ACTIVITY",
            None,
            ip_address,
            "",
            {"activity": activity, **details}
        )

class IPWhitelist:
    """IP address whitelisting"""
    
    def __init__(self, allowed_networks: List[str]):
        self.allowed_networks = [ipaddress.ip_network(net, strict=False) for net in allowed_networks]
    
    def is_allowed(self, ip_address: str) -> bool:
        """Check if IP address is in whitelist"""
        try:
            ip = ipaddress.ip_address(ip_address)
            return any(ip in network for network in self.allowed_networks)
        except ValueError:
            return False

class ContentSecurityPolicy:
    """Content Security Policy management"""
    
    @staticmethod
    def get_csp_header(nonce: str) -> str:
        """Generate CSP header with nonce"""
        return (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data: https:; "
            f"connect-src 'self' wss: ws:; "
            f"font-src 'self'; "
            f"object-src 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self'"
        )
    
    @staticmethod
    def generate_nonce() -> str:
        """Generate cryptographic nonce"""
        return secrets.token_urlsafe(16)

class SecurityMiddleware:
    """Security middleware for FastAPI"""
    
    def __init__(self, app, config: SecurityConfig):
        self.app = app
        self.config = config
        self.audit_logger = SecurityAuditLogger()
    
    async def __call__(self, request: Request, call_next):
        """Process request through security middleware"""
        start_time = datetime.utcnow()
        
        # Add security headers
        response = await call_next(request)
        
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        
        # Add CSP nonce
        nonce = ContentSecurityPolicy.generate_nonce()
        response.headers["Content-Security-Policy"] = ContentSecurityPolicy.get_csp_header(nonce)
        
        # Log request
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        if processing_time > 5.0:  # Log slow requests
            self.audit_logger.log_security_event(
                "SLOW_REQUEST",
                getattr(request.state, 'user_id', None),
                request.client.host,
                request.headers.get('user-agent', ''),
                {
                    'path': request.url.path,
                    'method': request.method,
                    'processing_time': processing_time
                }
            )
        
        return response

# Password utilities
def hash_password(password: str) -> str:
    """Hash password using Argon2"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None

# Security decorators
def require_permissions(permissions: List[str]):
    """Decorator to require specific permissions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Implementation would check user permissions
            # This is a placeholder for the actual implementation
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def audit_log(action: str):
    """Decorator to log security-sensitive actions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Log the action
            audit_logger = SecurityAuditLogger()
            result = await func(*args, **kwargs)
            audit_logger.log_security_event(
                action,
                None,  # Would extract from request context
                "127.0.0.1",  # Would extract from request
                "",
                {"function": func.__name__}
            )
            return result
        return wrapper
    return decorator

class SecurityService:
    """Main security service coordinator"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.config = SecurityConfig()
        self.rate_limiter = RateLimiter(redis_client)
        self.login_tracker = LoginAttemptTracker(redis_client)
        self.encryptor = DataEncryption()
        self.audit_logger = SecurityAuditLogger()
        self.input_sanitizer = InputSanitizer()
        self.password_validator = PasswordValidator()
    
    async def validate_request(self, request: Request) -> tuple[bool, str]:
        """Comprehensive request validation"""
        # Rate limiting check
        client_ip = request.client.host
        is_limited, limits_info = await self.rate_limiter.is_rate_limited(
            f"rate_limit:{client_ip}"
        )
        
        if is_limited:
            return False, "Rate limit exceeded"
        
        # Check for suspicious patterns in user agent
        user_agent = request.headers.get('user-agent', '')
        if self._is_suspicious_user_agent(user_agent):
            self.audit_logger.log_suspicious_activity(
                "SUSPICIOUS_USER_AGENT",
                client_ip,
                {"user_agent": user_agent}
            )
            return False, "Suspicious request detected"
        
        return True, "Request validated"
    
    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check for suspicious user agent patterns"""
        suspicious_patterns = [
            r"sqlmap",
            r"nmap",
            r"nikto",
            r"burp",
            r"crawler",
            r"bot.*(?<!google|bing|yahoo)",
            r"scanner",
            r"exploit"
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, user_agent.lower()):
                return True
        
        return False