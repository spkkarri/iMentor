"""
Embedding-based query classifier using semantic similarity.
"""

import numpy as np
import logging
from typing import Dict, List, Optional, Any
import json
import pickle
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import torch

# from .base_classifier import BaseQueryClassifier, ClassificationResult

# Fallback classes for when base_classifier is not available
class ClassificationResult:
    def __init__(self, predicted_subject, confidence, scores=None):
        self.predicted_subject = predicted_subject
        self.confidence = confidence
        self.scores = scores or {}

class BaseQueryClassifier:
    def __init__(self, subjects):
        self.subjects = subjects

logger = logging.getLogger(__name__)

class EmbeddingClassifier(BaseQueryClassifier):
    """
    Classifier using embeddings and semantic similarity.
    """
    
    def __init__(
        self,
        subjects: List[str],
        confidence_threshold: float = 0.6,
        embedding_model: str = "sentence-transformers",
        cache_dir: str = "cache"
    ):
        super().__init__(subjects, confidence_threshold)
        
        self.embedding_model_name = embedding_model
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Initialize embedding model
        self.embedding_model = self._load_embedding_model()
        
        # Subject exemplars (example queries for each subject)
        self.subject_exemplars = self._initialize_exemplars()
        
        # Precomputed embeddings
        self.exemplar_embeddings = None
        self._precompute_exemplar_embeddings()
    
    def _load_embedding_model(self):
        """Load the embedding model."""
        try:
            if self.embedding_model_name == "sentence-transformers":
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer('all-MiniLM-L6-v2')
                logger.info("Loaded SentenceTransformer model")
                return model
            
            elif self.embedding_model_name == "openai":
                # Placeholder for OpenAI embeddings
                logger.warning("OpenAI embeddings not implemented, falling back to TF-IDF")
                return self._create_tfidf_model()
            
            else:
                # Fallback to TF-IDF
                return self._create_tfidf_model()
                
        except ImportError:
            logger.warning("SentenceTransformers not available, using TF-IDF")
            return self._create_tfidf_model()
    
    def _create_tfidf_model(self):
        """Create TF-IDF vectorizer as fallback."""
        return TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
    
    def _initialize_exemplars(self) -> Dict[str, List[str]]:
        """Initialize example queries for each subject."""
        exemplars = {
            "mathematics": [
                "What is 15 + 27?",
                "How do you solve quadratic equations?",
                "Calculate the area of a circle with radius 5",
                "What is the derivative of x squared?",
                "Solve for x: 2x + 5 = 15",
                "What is the Pythagorean theorem?",
                "How do you find the mean of a dataset?",
                "What is the integral of sin(x)?",
                "Calculate 25% of 80",
                "What is the formula for compound interest?"
            ],
            
            "programming": [
                "How do you create a list in Python?",
                "What is object-oriented programming?",
                "How to implement binary search algorithm?",
                "What is the difference between == and === in JavaScript?",
                "How do you handle exceptions in Python?",
                "What is a recursive function?",
                "How to connect to a database in Python?",
                "What is the time complexity of quicksort?",
                "How do you create a REST API?",
                "What is the difference between list and tuple?"
            ],
            
            "science": [
                "What is photosynthesis?",
                "How does gravity work?",
                "What is the periodic table?",
                "Explain Newton's laws of motion",
                "What is DNA?",
                "How do vaccines work?",
                "What causes climate change?",
                "What is the speed of light?",
                "How do cells divide?",
                "What is the theory of evolution?"
            ],
            
            "history": [
                "When did World War II end?",
                "Who was Napoleon Bonaparte?",
                "What caused the American Civil War?",
                "When was the Renaissance period?",
                "Who built the pyramids?",
                "What was the Industrial Revolution?",
                "When did the Roman Empire fall?",
                "Who was Cleopatra?",
                "What was the Cold War?",
                "When did humans first land on the moon?"
            ],
            
            "literature": [
                "Who wrote Romeo and Juliet?",
                "What is a metaphor?",
                "Who is the author of Pride and Prejudice?",
                "What is the theme of To Kill a Mockingbird?",
                "What is iambic pentameter?",
                "Who wrote The Great Gatsby?",
                "What is symbolism in literature?",
                "What is the difference between simile and metaphor?",
                "Who wrote 1984?",
                "What is a sonnet?"
            ]
        }
        
        return exemplars
    
    def _precompute_exemplar_embeddings(self):
        """Precompute embeddings for all exemplars."""
        cache_file = self.cache_dir / "exemplar_embeddings.pkl"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    self.exemplar_embeddings = pickle.load(f)
                logger.info("Loaded cached exemplar embeddings")
                return
            except Exception as e:
                logger.warning(f"Failed to load cached embeddings: {e}")
        
        # Compute embeddings
        all_exemplars = []
        exemplar_labels = []
        
        for subject, exemplars in self.subject_exemplars.items():
            all_exemplars.extend(exemplars)
            exemplar_labels.extend([subject] * len(exemplars))
        
        if hasattr(self.embedding_model, 'encode'):
            # SentenceTransformer
            embeddings = self.embedding_model.encode(all_exemplars)
        else:
            # TF-IDF
            embeddings = self.embedding_model.fit_transform(all_exemplars).toarray()
        
        self.exemplar_embeddings = {
            'embeddings': embeddings,
            'labels': exemplar_labels,
            'texts': all_exemplars
        }
        
        # Cache the embeddings
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(self.exemplar_embeddings, f)
            logger.info("Cached exemplar embeddings")
        except Exception as e:
            logger.warning(f"Failed to cache embeddings: {e}")
    
    def classify(self, query: str) -> ClassificationResult:
        """Classify query using embedding similarity."""
        if self.exemplar_embeddings is None:
            logger.error("Exemplar embeddings not available")
            return self._fallback_classification(query)
        
        # Get query embedding
        if hasattr(self.embedding_model, 'encode'):
            # SentenceTransformer
            query_embedding = self.embedding_model.encode([query])
        else:
            # TF-IDF
            query_embedding = self.embedding_model.transform([query]).toarray()
        
        # Calculate similarities
        similarities = cosine_similarity(
            query_embedding,
            self.exemplar_embeddings['embeddings']
        )[0]
        
        # Aggregate scores by subject
        subject_scores = {subject: [] for subject in self.subjects}
        
        for i, (similarity, label) in enumerate(zip(similarities, self.exemplar_embeddings['labels'])):
            if label in subject_scores:
                subject_scores[label].append(similarity)
        
        # Calculate average similarity for each subject
        final_scores = {}
        for subject, scores in subject_scores.items():
            if scores:
                final_scores[subject] = np.mean(scores)
            else:
                final_scores[subject] = 0.0
        
        # Normalize scores
        total_score = sum(final_scores.values())
        if total_score > 0:
            for subject in final_scores:
                final_scores[subject] = final_scores[subject] / total_score
        else:
            # Equal distribution if no scores
            for subject in self.subjects:
                final_scores[subject] = 1.0 / len(self.subjects)
        
        # Find best subject
        best_subject = max(final_scores, key=final_scores.get)
        confidence = final_scores[best_subject]
        
        # Find most similar exemplar for reasoning
        best_exemplar_idx = np.argmax(similarities)
        best_exemplar = self.exemplar_embeddings['texts'][best_exemplar_idx]
        best_similarity = similarities[best_exemplar_idx]
        
        reasoning = f"Most similar to '{best_exemplar}' (similarity: {best_similarity:.3f})"
        
        # Get fallback subjects
        fallback_subjects = self.get_fallback_subjects(
            ClassificationResult(best_subject, confidence, final_scores, reasoning, [])
        )
        
        return ClassificationResult(
            predicted_subject=best_subject,
            confidence=confidence,
            subject_scores=final_scores,
            reasoning=reasoning,
            fallback_subjects=fallback_subjects
        )
    
    def _fallback_classification(self, query: str) -> ClassificationResult:
        """Fallback classification when embeddings are not available."""
        # Simple equal distribution
        scores = {subject: 1.0 / len(self.subjects) for subject in self.subjects}
        
        return ClassificationResult(
            predicted_subject=self.subjects[0],
            confidence=1.0 / len(self.subjects),
            subject_scores=scores,
            reasoning="Fallback: embeddings not available",
            fallback_subjects=self.subjects[1:]
        )
    
    def add_exemplars(self, subject: str, exemplars: List[str]):
        """Add new exemplars for a subject."""
        if subject not in self.subject_exemplars:
            self.subject_exemplars[subject] = []
        
        self.subject_exemplars[subject].extend(exemplars)
        
        # Recompute embeddings
        self._precompute_exemplar_embeddings()
        
        logger.info(f"Added {len(exemplars)} exemplars for {subject}")
    
    def evaluate_classification(self, test_queries: List[Dict[str, str]]) -> Dict[str, Any]:
        """Evaluate classifier performance on test queries."""
        correct = 0
        total = len(test_queries)
        subject_stats = {subject: {'correct': 0, 'total': 0} for subject in self.subjects}
        
        for query_data in test_queries:
            query = query_data['query']
            true_subject = query_data['subject']
            
            result = self.classify(query)
            predicted_subject = result.predicted_subject
            
            subject_stats[true_subject]['total'] += 1
            
            if predicted_subject == true_subject:
                correct += 1
                subject_stats[true_subject]['correct'] += 1
        
        # Calculate metrics
        overall_accuracy = correct / total if total > 0 else 0
        
        subject_accuracies = {}
        for subject, stats in subject_stats.items():
            if stats['total'] > 0:
                subject_accuracies[subject] = stats['correct'] / stats['total']
            else:
                subject_accuracies[subject] = 0
        
        return {
            'overall_accuracy': overall_accuracy,
            'subject_accuracies': subject_accuracies,
            'total_queries': total,
            'correct_predictions': correct
        }

class HybridEmbeddingClassifier(BaseQueryClassifier):
    """
    Hybrid classifier combining embeddings with other methods.
    """
    
    def __init__(
        self,
        subjects: List[str],
        confidence_threshold: float = 0.6,
        embedding_weight: float = 0.7,
        keyword_weight: float = 0.3
    ):
        super().__init__(subjects, confidence_threshold)
        
        self.embedding_weight = embedding_weight
        self.keyword_weight = keyword_weight
        
        # Initialize sub-classifiers
        from .base_classifier import KeywordClassifier
        
        self.embedding_classifier = EmbeddingClassifier(subjects, confidence_threshold)
        self.keyword_classifier = KeywordClassifier(subjects, confidence_threshold)
    
    def classify(self, query: str) -> ClassificationResult:
        """Classify using hybrid approach."""
        # Get results from both classifiers
        embedding_result = self.embedding_classifier.classify(query)
        keyword_result = self.keyword_classifier.classify(query)
        
        # Combine scores
        combined_scores = {}
        for subject in self.subjects:
            embedding_score = embedding_result.subject_scores.get(subject, 0)
            keyword_score = keyword_result.subject_scores.get(subject, 0)
            
            combined_scores[subject] = (
                embedding_score * self.embedding_weight +
                keyword_score * self.keyword_weight
            )
        
        # Normalize combined scores
        total_score = sum(combined_scores.values())
        if total_score > 0:
            for subject in combined_scores:
                combined_scores[subject] = combined_scores[subject] / total_score
        
        # Find best subject
        best_subject = max(combined_scores, key=combined_scores.get)
        confidence = combined_scores[best_subject]
        
        # Combine reasoning
        reasoning = f"Embedding: {embedding_result.reasoning} | Keywords: {keyword_result.reasoning}"
        
        # Get fallback subjects
        fallback_subjects = self.get_fallback_subjects(
            ClassificationResult(best_subject, confidence, combined_scores, reasoning, [])
        )
        
        return ClassificationResult(
            predicted_subject=best_subject,
            confidence=confidence,
            subject_scores=combined_scores,
            reasoning=reasoning,
            fallback_subjects=fallback_subjects
        )

# Alias for backward compatibility
class HybridEmbeddingClassifier(EmbeddingClassifier):
    """Hybrid classifier - alias for EmbeddingClassifier"""

    def __init__(self, subjects: List[str], **kwargs):
        try:
            super().__init__(subjects, **kwargs)
        except Exception as e:
            logger.warning(f"Failed to initialize full embedding classifier: {e}")
            # Fallback to simple implementation
            self.subjects = subjects
            self.confidence_threshold = kwargs.get('confidence_threshold', 0.6)

    def classify(self, query: str) -> ClassificationResult:
        """Classify query with fallback to simple keyword matching"""
        try:
            return super().classify(query)
        except Exception as e:
            logger.warning(f"Embedding classification failed, using fallback: {e}")
            return self._simple_classify(query)

    def _simple_classify(self, query: str) -> ClassificationResult:
        """Simple keyword-based classification fallback"""
        query_lower = query.lower()

        # Simple keyword mapping
        subject_keywords = {
            "mathematics": ["math", "calculate", "equation", "solve", "number", "+", "-", "*", "/"],
            "programming": ["code", "function", "program", "python", "javascript", "def", "class"],
            "science": ["science", "experiment", "theory", "physics", "chemistry", "biology"],
            "history": ["history", "war", "ancient", "civilization", "century"],
            "literature": ["literature", "book", "author", "poem", "novel", "wrote"]
        }

        scores = {}
        for subject in self.subjects:
            if subject in subject_keywords:
                score = sum(1 for keyword in subject_keywords[subject]
                          if keyword in query_lower)
                scores[subject] = score
            else:
                scores[subject] = 0

        # Find best match
        max_score = max(scores.values()) if scores else 0
        predicted_subject = max(scores, key=scores.get) if max_score > 0 else "general"
        confidence = min(max_score / 3, 1.0) if max_score > 0 else 0.0

        return ClassificationResult(
            predicted_subject=predicted_subject,
            confidence=confidence,
            scores=scores
        )
