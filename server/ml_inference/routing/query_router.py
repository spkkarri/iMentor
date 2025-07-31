"""
Query routing system for directing queries to appropriate specialized models.
"""

import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import json
from pathlib import Path

from ..query_classifier.base_classifier import BaseQueryClassifier, ClassificationResult
from ..query_classifier.embedding_classifier import HybridEmbeddingClassifier

logger = logging.getLogger(__name__)

class RoutingStrategy(Enum):
    """Routing strategies for query handling."""
    CONFIDENCE_BASED = "confidence_based"
    ROUND_ROBIN = "round_robin"
    LOAD_BALANCED = "load_balanced"
    FALLBACK_CASCADE = "fallback_cascade"

@dataclass
class RoutingDecision:
    """Result of routing decision."""
    primary_model: str
    fallback_models: List[str]
    confidence: float
    reasoning: str
    classification_result: ClassificationResult
    routing_time: float

@dataclass
class ModelStatus:
    """Status of a specialized model."""
    model_id: str
    subject: str
    is_loaded: bool
    is_available: bool
    load_time: float
    last_used: float
    usage_count: int
    average_response_time: float
    error_count: int

class QueryRouter:
    """
    Main query routing system that decides which model to use for each query.
    """
    
    def __init__(
        self,
        subjects: List[str],
        classifier: Optional[BaseQueryClassifier] = None,
        routing_strategy: RoutingStrategy = RoutingStrategy.CONFIDENCE_BASED,
        confidence_threshold: float = 0.6,
        fallback_model: str = "general",
        config_file: Optional[str] = None
    ):
        self.subjects = subjects
        self.routing_strategy = routing_strategy
        self.confidence_threshold = confidence_threshold
        self.fallback_model = fallback_model
        
        # Initialize classifier
        if classifier is None:
            self.classifier = HybridEmbeddingClassifier(
                subjects=subjects,
                confidence_threshold=confidence_threshold
            )
        else:
            self.classifier = classifier
        
        # Model status tracking
        self.model_status = {
            subject: ModelStatus(
                model_id=f"{subject}_model",
                subject=subject,
                is_loaded=False,
                is_available=False,
                load_time=0.0,
                last_used=0.0,
                usage_count=0,
                average_response_time=0.0,
                error_count=0
            ) for subject in subjects
        }
        
        # Add fallback model
        if fallback_model not in self.model_status:
            self.model_status[fallback_model] = ModelStatus(
                model_id=f"{fallback_model}_model",
                subject=fallback_model,
                is_loaded=True,  # Assume fallback is always available
                is_available=True,
                load_time=0.0,
                last_used=time.time(),
                usage_count=0,
                average_response_time=0.0,
                error_count=0
            )
        
        # Routing statistics
        self.routing_stats = {
            "total_queries": 0,
            "successful_routes": 0,
            "fallback_routes": 0,
            "classification_errors": 0,
            "subject_distribution": {subject: 0 for subject in subjects}
        }
        
        # Load configuration if provided
        if config_file:
            self.load_config(config_file)
        
        logger.info(f"QueryRouter initialized with {len(subjects)} subjects")
    
    def route_query(self, query: str, user_context: Optional[Dict[str, Any]] = None) -> RoutingDecision:
        """
        Route a query to the appropriate model.
        
        Args:
            query: The user query to route
            user_context: Optional context about the user (preferences, history, etc.)
        
        Returns:
            RoutingDecision with model selection and reasoning
        """
        start_time = time.time()
        
        try:
            # Classify the query
            classification_result = self.classifier.classify(query)
            
            # Apply routing strategy
            primary_model, fallback_models = self._apply_routing_strategy(
                classification_result, user_context
            )
            
            # Update statistics
            self._update_routing_stats(classification_result, primary_model)
            
            routing_time = time.time() - start_time
            
            decision = RoutingDecision(
                primary_model=primary_model,
                fallback_models=fallback_models,
                confidence=classification_result.confidence,
                reasoning=self._generate_routing_reasoning(classification_result, primary_model),
                classification_result=classification_result,
                routing_time=routing_time
            )
            
            logger.info(f"Routed query to {primary_model} (confidence: {classification_result.confidence:.3f})")
            
            return decision
            
        except Exception as e:
            logger.error(f"Error in query routing: {e}")
            
            # Fallback to default model
            routing_time = time.time() - start_time
            
            return RoutingDecision(
                primary_model=self.fallback_model,
                fallback_models=[],
                confidence=0.0,
                reasoning=f"Error in routing: {str(e)}",
                classification_result=None,
                routing_time=routing_time
            )
    
    def _apply_routing_strategy(
        self,
        classification_result: ClassificationResult,
        user_context: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, List[str]]:
        """Apply the configured routing strategy."""
        
        if self.routing_strategy == RoutingStrategy.CONFIDENCE_BASED:
            return self._confidence_based_routing(classification_result)
        
        elif self.routing_strategy == RoutingStrategy.FALLBACK_CASCADE:
            return self._fallback_cascade_routing(classification_result)
        
        elif self.routing_strategy == RoutingStrategy.LOAD_BALANCED:
            return self._load_balanced_routing(classification_result)
        
        else:
            # Default to confidence-based
            return self._confidence_based_routing(classification_result)
    
    def _confidence_based_routing(self, result: ClassificationResult) -> Tuple[str, List[str]]:
        """Route based on classification confidence."""
        primary_subject = result.predicted_subject
        
        # Check if confidence is above threshold and model is available
        if (result.confidence >= self.confidence_threshold and 
            self._is_model_available(primary_subject)):
            
            primary_model = primary_subject
            fallback_models = [
                subject for subject in result.fallback_subjects 
                if self._is_model_available(subject)
            ]
            
            # Add general fallback if not already included
            if self.fallback_model not in fallback_models:
                fallback_models.append(self.fallback_model)
        
        else:
            # Use fallback model
            primary_model = self.fallback_model
            fallback_models = []
        
        return primary_model, fallback_models
    
    def _fallback_cascade_routing(self, result: ClassificationResult) -> Tuple[str, List[str]]:
        """Route with cascading fallbacks."""
        # Try primary model first
        if self._is_model_available(result.predicted_subject):
            primary_model = result.predicted_subject
        else:
            # Try fallback subjects
            primary_model = self.fallback_model
            for subject in result.fallback_subjects:
                if self._is_model_available(subject):
                    primary_model = subject
                    break
        
        # Build fallback chain
        fallback_models = []
        for subject in result.fallback_subjects:
            if subject != primary_model and self._is_model_available(subject):
                fallback_models.append(subject)
        
        if self.fallback_model not in fallback_models and primary_model != self.fallback_model:
            fallback_models.append(self.fallback_model)
        
        return primary_model, fallback_models
    
    def _load_balanced_routing(self, result: ClassificationResult) -> Tuple[str, List[str]]:
        """Route based on model load and availability."""
        # Get top candidates
        candidates = [result.predicted_subject] + result.fallback_subjects
        
        # Filter available models and sort by usage
        available_candidates = [
            subject for subject in candidates 
            if self._is_model_available(subject)
        ]
        
        if available_candidates:
            # Sort by usage count (ascending) to balance load
            available_candidates.sort(
                key=lambda s: self.model_status[s].usage_count
            )
            primary_model = available_candidates[0]
            fallback_models = available_candidates[1:]
        else:
            primary_model = self.fallback_model
            fallback_models = []
        
        return primary_model, fallback_models
    
    def _is_model_available(self, subject: str) -> bool:
        """Check if a model is available for use."""
        if subject not in self.model_status:
            return False
        
        status = self.model_status[subject]
        return status.is_loaded and status.is_available
    
    def _generate_routing_reasoning(self, result: ClassificationResult, primary_model: str) -> str:
        """Generate human-readable reasoning for routing decision."""
        reasoning_parts = [
            f"Classification: {result.reasoning}",
            f"Selected model: {primary_model}",
            f"Confidence: {result.confidence:.3f}"
        ]
        
        if result.confidence < self.confidence_threshold:
            reasoning_parts.append("Low confidence - using fallback")
        
        if not self._is_model_available(result.predicted_subject):
            reasoning_parts.append(f"Primary model ({result.predicted_subject}) unavailable")
        
        return " | ".join(reasoning_parts)
    
    def _update_routing_stats(self, result: ClassificationResult, selected_model: str):
        """Update routing statistics."""
        self.routing_stats["total_queries"] += 1
        
        if selected_model == self.fallback_model:
            self.routing_stats["fallback_routes"] += 1
        else:
            self.routing_stats["successful_routes"] += 1
        
        if result and result.predicted_subject in self.routing_stats["subject_distribution"]:
            self.routing_stats["subject_distribution"][result.predicted_subject] += 1
    
    def update_model_status(
        self,
        subject: str,
        is_loaded: bool = None,
        is_available: bool = None,
        response_time: float = None,
        error_occurred: bool = False
    ):
        """Update the status of a model."""
        if subject not in self.model_status:
            logger.warning(f"Unknown subject: {subject}")
            return
        
        status = self.model_status[subject]
        
        if is_loaded is not None:
            status.is_loaded = is_loaded
            if is_loaded:
                status.load_time = time.time()
        
        if is_available is not None:
            status.is_available = is_available
        
        if response_time is not None:
            # Update average response time
            if status.usage_count > 0:
                status.average_response_time = (
                    (status.average_response_time * status.usage_count + response_time) /
                    (status.usage_count + 1)
                )
            else:
                status.average_response_time = response_time
        
        if error_occurred:
            status.error_count += 1
        
        status.usage_count += 1
        status.last_used = time.time()
        
        logger.debug(f"Updated status for {subject}: loaded={status.is_loaded}, available={status.is_available}")
    
    def get_routing_statistics(self) -> Dict[str, Any]:
        """Get comprehensive routing statistics."""
        stats = self.routing_stats.copy()
        
        # Add model status information
        stats["model_status"] = {}
        for subject, status in self.model_status.items():
            stats["model_status"][subject] = {
                "is_loaded": status.is_loaded,
                "is_available": status.is_available,
                "usage_count": status.usage_count,
                "average_response_time": status.average_response_time,
                "error_count": status.error_count,
                "last_used": status.last_used
            }
        
        # Calculate success rate
        total = stats["total_queries"]
        if total > 0:
            stats["success_rate"] = stats["successful_routes"] / total
            stats["fallback_rate"] = stats["fallback_routes"] / total
        else:
            stats["success_rate"] = 0
            stats["fallback_rate"] = 0
        
        return stats
    
    def save_config(self, config_file: str):
        """Save router configuration to file."""
        config = {
            "subjects": self.subjects,
            "routing_strategy": self.routing_strategy.value,
            "confidence_threshold": self.confidence_threshold,
            "fallback_model": self.fallback_model,
            "routing_stats": self.routing_stats
        }
        
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Router configuration saved to {config_file}")
    
    def load_config(self, config_file: str):
        """Load router configuration from file."""
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            self.routing_strategy = RoutingStrategy(config.get("routing_strategy", "confidence_based"))
            self.confidence_threshold = config.get("confidence_threshold", 0.6)
            self.fallback_model = config.get("fallback_model", "general")
            
            if "routing_stats" in config:
                self.routing_stats.update(config["routing_stats"])
            
            logger.info(f"Router configuration loaded from {config_file}")
            
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
    
    def reset_statistics(self):
        """Reset routing statistics."""
        self.routing_stats = {
            "total_queries": 0,
            "successful_routes": 0,
            "fallback_routes": 0,
            "classification_errors": 0,
            "subject_distribution": {subject: 0 for subject in self.subjects}
        }
        
        logger.info("Routing statistics reset")
