"""
Comprehensive monitoring and observability for Clinical Decision Support System
Production-grade monitoring, metrics, and alerting
"""

import time
import asyncio
import psutil
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
from prometheus_client import Counter, Histogram, Gauge, Summary, start_http_server
from prometheus_client.core import CollectorRegistry
import structlog
import json
from pathlib import Path
import aioredis
from sqlalchemy.ext.asyncio import AsyncSession
import numpy as np
from collections import defaultdict, deque
import threading
import socket

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REGISTRY = CollectorRegistry()

# HTTP Metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=REGISTRY
)

http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    registry=REGISTRY
)

# Clinical Processing Metrics
clinical_queries_total = Counter(
    'clinical_queries_total',
    'Total clinical queries processed',
    ['status'],
    registry=REGISTRY
)

clinical_query_duration = Histogram(
    'clinical_query_duration_seconds',
    'Clinical query processing duration',
    ['query_type'],
    registry=REGISTRY
)

pubmed_api_requests = Counter(
    'pubmed_api_requests_total',
    'Total PubMed API requests',
    ['status'],
    registry=REGISTRY
)

pubmed_api_rate_limited = Counter(
    'pubmed_api_rate_limited_total',
    'PubMed API rate limit hits',
    registry=REGISTRY
)

# Vector Database Metrics
vector_db_operations = Counter(
    'vector_db_operations_total',
    'Vector database operations',
    ['operation', 'status'],
    registry=REGISTRY
)

vector_db_query_duration = Histogram(
    'vector_db_query_duration_seconds',
    'Vector database query duration',
    ['operation'],
    registry=REGISTRY
)

embeddings_generated = Counter(
    'embeddings_generated_total',
    'Total embeddings generated',
    ['model'],
    registry=REGISTRY
)

# System Metrics
system_cpu_percent = Gauge(
    'system_cpu_percent',
    'System CPU usage percentage',
    registry=REGISTRY
)

system_memory_percent = Gauge(
    'system_memory_percent',
    'System memory usage percentage',
    registry=REGISTRY
)

system_disk_percent = Gauge(
    'system_disk_percent',
    'System disk usage percentage',
    ['mount_point'],
    registry=REGISTRY
)

active_websocket_connections = Gauge(
    'websocket_connections_active',
    'Active WebSocket connections',
    registry=REGISTRY
)

# Model Performance Metrics
model_inference_duration = Histogram(
    'model_inference_duration_seconds',
    'Model inference duration',
    ['model_name', 'operation'],
    registry=REGISTRY
)

model_accuracy_score = Gauge(
    'model_accuracy_score',
    'Model accuracy score',
    ['model_name', 'metric'],
    registry=REGISTRY
)

# Error Metrics
errors_total = Counter(
    'errors_total',
    'Total errors',
    ['error_type', 'component'],
    registry=REGISTRY
)

# Cache Metrics
cache_hits_total = Counter(
    'cache_hits_total',
    'Cache hits',
    ['cache_type'],
    registry=REGISTRY
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Cache misses',
    ['cache_type'],
    registry=REGISTRY
)

@dataclass
class PerformanceMetrics:
    """Performance metrics container"""
    response_times: deque = field(default_factory=lambda: deque(maxlen=1000))
    error_rates: deque = field(default_factory=lambda: deque(maxlen=100))
    throughput: deque = field(default_factory=lambda: deque(maxlen=100))
    memory_usage: deque = field(default_factory=lambda: deque(maxlen=100))
    cpu_usage: deque = field(default_factory=lambda: deque(maxlen=100))
    
    def add_response_time(self, duration: float):
        """Add response time measurement"""
        self.response_times.append({
            'timestamp': datetime.utcnow(),
            'duration': duration
        })
    
    def get_avg_response_time(self, minutes: int = 5) -> float:
        """Get average response time for last N minutes"""
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        recent_times = [
            r['duration'] for r in self.response_times 
            if r['timestamp'] > cutoff
        ]
        return np.mean(recent_times) if recent_times else 0.0
    
    def get_p95_response_time(self, minutes: int = 5) -> float:
        """Get 95th percentile response time"""
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        recent_times = [
            r['duration'] for r in self.response_times 
            if r['timestamp'] > cutoff
        ]
        return np.percentile(recent_times, 95) if recent_times else 0.0

class HealthChecker:
    """Comprehensive health checking"""
    
    def __init__(self):
        self.checks: Dict[str, Callable] = {}
        self.last_check_results: Dict[str, Dict] = {}
    
    def register_check(self, name: str, check_func: Callable):
        """Register a health check function"""
        self.checks[name] = check_func
    
    async def run_all_checks(self) -> Dict[str, Any]:
        """Run all registered health checks"""
        results = {}
        overall_status = "healthy"
        
        for name, check_func in self.checks.items():
            try:
                start_time = time.time()
                if asyncio.iscoroutinefunction(check_func):
                    result = await check_func()
                else:
                    result = check_func()
                
                duration = time.time() - start_time
                
                check_result = {
                    "status": "healthy" if result.get("healthy", True) else "unhealthy",
                    "message": result.get("message", "OK"),
                    "duration_ms": round(duration * 1000, 2),
                    "details": result.get("details", {}),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                results[name] = check_result
                
                if check_result["status"] != "healthy":
                    overall_status = "unhealthy"
                    
            except Exception as e:
                results[name] = {
                    "status": "error",
                    "message": f"Health check failed: {str(e)}",
                    "timestamp": datetime.utcnow().isoformat()
                }
                overall_status = "unhealthy"
                logger.error(f"Health check {name} failed", error=str(e))
        
        self.last_check_results = results
        
        return {
            "status": overall_status,
            "checks": results,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def check_database(self, session: AsyncSession) -> Dict[str, Any]:
        """Database connectivity check"""
        try:
            result = await session.execute("SELECT 1")
            return {"healthy": True, "message": "Database accessible"}
        except Exception as e:
            return {"healthy": False, "message": f"Database error: {str(e)}"}
    
    async def check_redis(self, redis_client: aioredis.Redis) -> Dict[str, Any]:
        """Redis connectivity check"""
        try:
            await redis_client.ping()
            return {"healthy": True, "message": "Redis accessible"}
        except Exception as e:
            return {"healthy": False, "message": f"Redis error: {str(e)}"}
    
    def check_disk_space(self) -> Dict[str, Any]:
        """Disk space check"""
        try:
            usage = psutil.disk_usage('/')
            percent_used = (usage.used / usage.total) * 100
            
            if percent_used > 90:
                return {
                    "healthy": False, 
                    "message": f"Disk usage critical: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used}
                }
            elif percent_used > 80:
                return {
                    "healthy": True, 
                    "message": f"Disk usage warning: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used}
                }
            else:
                return {
                    "healthy": True, 
                    "message": f"Disk usage normal: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used}
                }
        except Exception as e:
            return {"healthy": False, "message": f"Disk check error: {str(e)}"}
    
    def check_memory(self) -> Dict[str, Any]:
        """Memory usage check"""
        try:
            memory = psutil.virtual_memory()
            percent_used = memory.percent
            
            if percent_used > 90:
                return {
                    "healthy": False,
                    "message": f"Memory usage critical: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used, "available_mb": memory.available // (1024*1024)}
                }
            elif percent_used > 80:
                return {
                    "healthy": True,
                    "message": f"Memory usage warning: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used, "available_mb": memory.available // (1024*1024)}
                }
            else:
                return {
                    "healthy": True,
                    "message": f"Memory usage normal: {percent_used:.1f}%",
                    "details": {"percent_used": percent_used, "available_mb": memory.available // (1024*1024)}
                }
        except Exception as e:
            return {"healthy": False, "message": f"Memory check error: {str(e)}"}

class AlertManager:
    """Alert management system"""
    
    def __init__(self, notification_channels: List[str] = None):
        self.notification_channels = notification_channels or []
        self.alert_history: List[Dict] = []
        self.alert_rules: List[Dict] = []
        self.active_alerts: Dict[str, Dict] = {}
        
    def add_alert_rule(self, rule: Dict[str, Any]):
        """Add alert rule"""
        required_fields = ['name', 'condition', 'severity', 'message']
        if not all(field in rule for field in required_fields):
            raise ValueError(f"Alert rule must contain: {required_fields}")
        
        self.alert_rules.append({
            **rule,
            'created_at': datetime.utcnow(),
            'enabled': True
        })
    
    async def evaluate_alerts(self, metrics: Dict[str, Any]):
        """Evaluate all alert rules against current metrics"""
        for rule in self.alert_rules:
            if not rule.get('enabled', True):
                continue
            
            try:
                condition_met = await self._evaluate_condition(rule['condition'], metrics)
                
                if condition_met:
                    await self._trigger_alert(rule, metrics)
                else:
                    await self._resolve_alert(rule['name'])
                    
            except Exception as e:
                logger.error(f"Error evaluating alert rule {rule['name']}", error=str(e))
    
    async def _evaluate_condition(self, condition: str, metrics: Dict[str, Any]) -> bool:
        """Evaluate alert condition"""
        # This is a simplified implementation
        # In production, you'd want a more robust expression evaluator
        try:
            # Replace metric names with actual values
            for key, value in metrics.items():
                condition = condition.replace(f"${key}", str(value))
            
            # Evaluate the condition (careful with eval in production!)
            # Consider using a safe expression evaluator library
            return eval(condition)
        except Exception:
            return False
    
    async def _trigger_alert(self, rule: Dict[str, Any], metrics: Dict[str, Any]):
        """Trigger an alert"""
        alert_id = rule['name']
        
        if alert_id not in self.active_alerts:
            alert = {
                'id': alert_id,
                'rule': rule,
                'triggered_at': datetime.utcnow(),
                'severity': rule['severity'],
                'message': rule['message'],
                'metrics': metrics,
                'status': 'active'
            }
            
            self.active_alerts[alert_id] = alert
            self.alert_history.append(alert.copy())
            
            await self._send_notifications(alert)
            
            logger.error(
                f"ALERT TRIGGERED: {rule['name']}",
                severity=rule['severity'],
                message=rule['message'],
                metrics=metrics
            )
    
    async def _resolve_alert(self, alert_id: str):
        """Resolve an active alert"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert['status'] = 'resolved'
            alert['resolved_at'] = datetime.utcnow()
            
            del self.active_alerts[alert_id]
            
            logger.info(f"ALERT RESOLVED: {alert_id}")
    
    async def _send_notifications(self, alert: Dict[str, Any]):
        """Send alert notifications"""
        # Implementation would send to configured channels
        # (email, Slack, PagerDuty, etc.)
        pass

class PerformanceProfiler:
    """Performance profiling and analysis"""
    
    def __init__(self):
        self.profiles: Dict[str, List[Dict]] = defaultdict(list)
        self.lock = threading.Lock()
    
    @asynccontextmanager
    async def profile_operation(self, operation_name: str, tags: Dict[str, str] = None):
        """Context manager for profiling operations"""
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss
        
        try:
            yield
        finally:
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss
            
            duration = end_time - start_time
            memory_delta = end_memory - start_memory
            
            profile_data = {
                'operation': operation_name,
                'duration': duration,
                'memory_delta': memory_delta,
                'timestamp': datetime.utcnow(),
                'tags': tags or {}
            }
            
            with self.lock:
                self.profiles[operation_name].append(profile_data)
                
                # Keep only last 1000 entries per operation
                if len(self.profiles[operation_name]) > 1000:
                    self.profiles[operation_name] = self.profiles[operation_name][-1000:]
            
            # Record Prometheus metrics
            if 'model_name' in (tags or {}):
                model_inference_duration.labels(
                    model_name=tags['model_name'],
                    operation=operation_name
                ).observe(duration)
    
    def get_performance_summary(self, operation_name: str = None) -> Dict[str, Any]:
        """Get performance summary for operations"""
        with self.lock:
            if operation_name:
                profiles = self.profiles.get(operation_name, [])
            else:
                profiles = []
                for op_profiles in self.profiles.values():
                    profiles.extend(op_profiles)
        
        if not profiles:
            return {"message": "No performance data available"}
        
        durations = [p['duration'] for p in profiles]
        memory_deltas = [p['memory_delta'] for p in profiles]
        
        return {
            'operation': operation_name or 'all',
            'total_calls': len(profiles),
            'avg_duration': np.mean(durations),
            'p50_duration': np.percentile(durations, 50),
            'p95_duration': np.percentile(durations, 95),
            'p99_duration': np.percentile(durations, 99),
            'max_duration': np.max(durations),
            'avg_memory_delta': np.mean(memory_deltas),
            'max_memory_delta': np.max(memory_deltas)
        }

class SystemMonitor:
    """System resource monitoring"""
    
    def __init__(self):
        self.monitoring = False
        self.monitor_task = None
        
    async def start_monitoring(self, interval: int = 30):
        """Start system monitoring"""
        self.monitoring = True
        self.monitor_task = asyncio.create_task(self._monitor_loop(interval))
    
    async def stop_monitoring(self):
        """Stop system monitoring"""
        self.monitoring = False
        if self.monitor_task:
            self.monitor_task.cancel()
    
    async def _monitor_loop(self, interval: int):
        """Main monitoring loop"""
        while self.monitoring:
            try:
                await self._collect_system_metrics()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in monitoring loop", error=str(e))
                await asyncio.sleep(interval)
    
    async def _collect_system_metrics(self):
        """Collect system metrics"""
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        system_cpu_percent.set(cpu_percent)
        
        # Memory usage
        memory = psutil.virtual_memory()
        system_memory_percent.set(memory.percent)
        
        # Disk usage
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                percent_used = (usage.used / usage.total) * 100
                system_disk_percent.labels(mount_point=partition.mountpoint).set(percent_used)
            except PermissionError:
                continue
        
        # Network I/O
        net_io = psutil.net_io_counters()
        
        # Process info
        process = psutil.Process()
        
        logger.info(
            "System metrics collected",
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            process_memory_mb=process.memory_info().rss // (1024*1024),
            process_cpu_percent=process.cpu_percent(),
            network_bytes_sent=net_io.bytes_sent,
            network_bytes_recv=net_io.bytes_recv
        )

class MonitoringService:
    """Main monitoring service coordinator"""
    
    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.health_checker = HealthChecker()
        self.alert_manager = AlertManager()
        self.performance_profiler = PerformanceProfiler()
        self.system_monitor = SystemMonitor()
        self.performance_metrics = PerformanceMetrics()
        self.redis_client = redis_client
        
        # Register default health checks
        self._register_default_health_checks()
        self._setup_default_alerts()
    
    def _register_default_health_checks(self):
        """Register default health checks"""
        self.health_checker.register_check("disk_space", self.health_checker.check_disk_space)
        self.health_checker.register_check("memory", self.health_checker.check_memory)
        
        if self.redis_client:
            self.health_checker.register_check("redis", lambda: self.health_checker.check_redis(self.redis_client))
    
    def _setup_default_alerts(self):
        """Setup default alert rules"""
        default_rules = [
            {
                "name": "high_cpu_usage",
                "condition": "$cpu_percent > 80",
                "severity": "warning",
                "message": "CPU usage is above 80%"
            },
            {
                "name": "high_memory_usage",
                "condition": "$memory_percent > 85",
                "severity": "warning",
                "message": "Memory usage is above 85%"
            },
            {
                "name": "slow_response_time",
                "condition": "$avg_response_time > 5.0",
                "severity": "warning",
                "message": "Average response time is above 5 seconds"
            },
            {
                "name": "high_error_rate",
                "condition": "$error_rate > 0.1",
                "severity": "critical",
                "message": "Error rate is above 10%"
            }
        ]
        
        for rule in default_rules:
            self.alert_manager.add_alert_rule(rule)
    
    async def start(self, metrics_port: int = 8001):
        """Start monitoring service"""
        # Start Prometheus metrics server
        start_http_server(metrics_port, registry=REGISTRY)
        
        # Start system monitoring
        await self.system_monitor.start_monitoring()
        
        logger.info(f"Monitoring service started on port {metrics_port}")
    
    async def stop(self):
        """Stop monitoring service"""
        await self.system_monitor.stop_monitoring()
        logger.info("Monitoring service stopped")
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status"""
        return await self.health_checker.run_all_checks()
    
    def record_http_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Record HTTP request metrics"""
        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code)
        ).inc()
        
        http_request_duration.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)
        
        self.performance_metrics.add_response_time(duration)
    
    def record_clinical_query(self, status: str, duration: float, query_type: str = "general"):
        """Record clinical query metrics"""
        clinical_queries_total.labels(status=status).inc()
        clinical_query_duration.labels(query_type=query_type).observe(duration)
    
    def record_vector_db_operation(self, operation: str, status: str, duration: float):
        """Record vector database operation metrics"""
        vector_db_operations.labels(operation=operation, status=status).inc()
        vector_db_query_duration.labels(operation=operation).observe(duration)
    
    def record_error(self, error_type: str, component: str):
        """Record error metrics"""
        errors_total.labels(error_type=error_type, component=component).inc()
    
    async def generate_monitoring_report(self) -> Dict[str, Any]:
        """Generate comprehensive monitoring report"""
        health_status = await self.get_health_status()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "health": health_status,
            "performance": {
                "avg_response_time_5min": self.performance_metrics.get_avg_response_time(5),
                "p95_response_time_5min": self.performance_metrics.get_p95_response_time(5),
            },
            "alerts": {
                "active_count": len(self.alert_manager.active_alerts),
                "active_alerts": list(self.alert_manager.active_alerts.values())
            },
            "system": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage": [
                    {
                        "mountpoint": p.mountpoint,
                        "percent": (psutil.disk_usage(p.mountpoint).used / psutil.disk_usage(p.mountpoint).total) * 100
                    }
                    for p in psutil.disk_partitions()
                ]
            }
        }

# Monitoring decorators
def monitor_performance(operation_name: str, tags: Dict[str, str] = None):
    """Decorator for monitoring function performance"""
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                profiler = PerformanceProfiler()
                async with profiler.profile_operation(operation_name, tags):
                    return await func(*args, **kwargs)
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    duration = time.time() - start_time
                    logger.info(f"Operation {operation_name} completed", duration=duration, tags=tags)
            return sync_wrapper
    return decorator

def track_errors(component: str):
    """Decorator for tracking errors"""
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    errors_total.labels(
                        error_type=type(e).__name__,
                        component=component
                    ).inc()
                    raise
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    errors_total.labels(
                        error_type=type(e).__name__,
                        component=component
                    ).inc()
                    raise
            return sync_wrapper
    return decorator