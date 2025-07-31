"""
Base query classification system for routing queries to specialized models.
"""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass
import numpy as np
from collections import defaultdict

logger = logging.getLogger(__name__)

@dataclass
class ClassificationResult:
    """Result of query classification."""
    predicted_subject: str
    confidence: float
    subject_scores: Dict[str, float]
    reasoning: str
    fallback_subjects: List[str]

class BaseQueryClassifier(ABC):
    """
    Abstract base class for query classifiers.
    """
    
    def __init__(self, subjects: List[str], confidence_threshold: float = 0.6):
        self.subjects = subjects
        self.confidence_threshold = confidence_threshold
        self.fallback_subject = "general"
        
    @abstractmethod
    def classify(self, query: str) -> ClassificationResult:
        """Classify a query and return the predicted subject."""
        pass
    
    def is_confident(self, result: ClassificationResult) -> bool:
        """Check if the classification result is confident enough."""
        return result.confidence >= self.confidence_threshold
    
    def get_fallback_subjects(self, result: ClassificationResult, top_k: int = 2) -> List[str]:
        """Get fallback subjects based on scores."""
        sorted_subjects = sorted(
            result.subject_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return [subject for subject, _ in sorted_subjects[1:top_k+1]]

class KeywordClassifier(BaseQueryClassifier):
    """
    Keyword-based query classifier using predefined subject keywords.
    """
    
    def __init__(self, subjects: List[str], confidence_threshold: float = 0.6):
        super().__init__(subjects, confidence_threshold)
        self.subject_keywords = self._initialize_keywords()
        
    def _initialize_keywords(self) -> Dict[str, List[str]]:
        """Initialize subject-specific keywords."""
        keywords = {
            "mathematics": [
                # Basic math
                "math", "mathematics", "calculate", "computation", "solve", "equation",
                "formula", "number", "digit", "sum", "difference", "product", "quotient",
                
                # Arithmetic
                "add", "addition", "subtract", "subtraction", "multiply", "multiplication",
                "divide", "division", "plus", "minus", "times", "divided",
                
                # Advanced math
                "algebra", "geometry", "calculus", "trigonometry", "statistics", "probability",
                "derivative", "integral", "function", "variable", "coefficient", "polynomial",
                "theorem", "proof", "logarithm", "exponential", "matrix", "vector",
                
                # Geometry
                "triangle", "circle", "square", "rectangle", "polygon", "angle", "area",
                "perimeter", "volume", "radius", "diameter", "circumference", "hypotenuse",
                
                # Symbols and operations
                "=", "+", "-", "*", "/", "^", "√", "∑", "∫", "∂", "π", "∞"
            ],
            
            "programming": [
                # General programming
                "code", "programming", "program", "software", "development", "coding",
                "algorithm", "function", "method", "class", "object", "variable",
                "loop", "condition", "if", "else", "for", "while", "return",
                
                # Languages
                "python", "javascript", "java", "c++", "c#", "html", "css", "sql",
                "php", "ruby", "go", "rust", "swift", "kotlin", "typescript",
                
                # Concepts
                "array", "list", "dictionary", "string", "integer", "boolean",
                "recursion", "iteration", "sorting", "searching", "data structure",
                "database", "api", "framework", "library", "debugging", "testing",
                
                # Syntax
                "def", "class", "import", "from", "try", "except", "finally",
                "lambda", "yield", "async", "await", "print", "input"
            ],
            
            "science": [
                # General science
                "science", "scientific", "experiment", "hypothesis", "theory", "research",
                "observation", "data", "analysis", "conclusion", "method",
                
                # Physics
                "physics", "force", "energy", "motion", "velocity", "acceleration",
                "gravity", "mass", "weight", "pressure", "temperature", "heat",
                "light", "sound", "electricity", "magnetism", "atom", "molecule",
                "quantum", "relativity", "newton", "einstein",
                
                # Chemistry
                "chemistry", "chemical", "element", "compound", "reaction", "bond",
                "acid", "base", "ph", "ion", "electron", "proton", "neutron",
                "periodic table", "oxidation", "reduction", "catalyst", "solution",
                
                # Biology
                "biology", "biological", "cell", "organism", "species", "evolution",
                "dna", "rna", "protein", "gene", "chromosome", "photosynthesis",
                "respiration", "ecosystem", "habitat", "biodiversity"
            ],
            
            "history": [
                # General history
                "history", "historical", "past", "ancient", "medieval", "modern",
                "century", "decade", "year", "era", "period", "age", "timeline",
                
                # Events and concepts
                "war", "battle", "revolution", "empire", "kingdom", "civilization",
                "culture", "society", "politics", "government", "democracy",
                "monarchy", "republic", "constitution", "independence",
                
                # People and places
                "king", "queen", "emperor", "president", "leader", "general",
                "europe", "asia", "africa", "america", "rome", "greece",
                "egypt", "china", "india", "britain", "france", "germany",
                
                # Time periods
                "renaissance", "enlightenment", "industrial revolution",
                "world war", "cold war", "prehistoric", "classical"
            ],
            
            "literature": [
                # General literature
                "literature", "literary", "book", "novel", "story", "poem", "poetry",
                "author", "writer", "poet", "playwright", "character", "plot",
                "theme", "setting", "narrative", "fiction", "non-fiction",
                
                # Literary devices
                "metaphor", "simile", "symbolism", "irony", "alliteration",
                "personification", "hyperbole", "imagery", "foreshadowing",
                "flashback", "allegory", "satire", "tragedy", "comedy",
                
                # Genres and forms
                "drama", "epic", "sonnet", "haiku", "essay", "biography",
                "autobiography", "memoir", "journal", "diary", "letter",
                
                # Famous works and authors
                "shakespeare", "dickens", "austen", "hemingway", "tolkien",
                "romeo and juliet", "hamlet", "pride and prejudice"
            ]
        }
        
        return keywords
    
    def classify(self, query: str) -> ClassificationResult:
        """Classify query using keyword matching."""
        query_lower = query.lower()
        
        # Remove punctuation and split into words
        words = re.findall(r'\b\w+\b', query_lower)
        
        # Count keyword matches for each subject
        subject_scores = {}
        total_matches = 0
        
        for subject, keywords in self.subject_keywords.items():
            matches = 0
            for keyword in keywords:
                if keyword.lower() in query_lower:
                    # Give more weight to exact word matches
                    if keyword.lower() in words:
                        matches += 2
                    else:
                        matches += 1
            
            subject_scores[subject] = matches
            total_matches += matches
        
        # Normalize scores
        if total_matches > 0:
            for subject in subject_scores:
                subject_scores[subject] = subject_scores[subject] / total_matches
        else:
            # No matches found, assign equal probability
            for subject in self.subjects:
                subject_scores[subject] = 1.0 / len(self.subjects)
        
        # Find best subject
        best_subject = max(subject_scores, key=subject_scores.get)
        confidence = subject_scores[best_subject]
        
        # Generate reasoning
        reasoning = self._generate_reasoning(query, best_subject, subject_scores)
        
        # Get fallback subjects
        fallback_subjects = self.get_fallback_subjects(
            ClassificationResult(best_subject, confidence, subject_scores, reasoning, [])
        )
        
        return ClassificationResult(
            predicted_subject=best_subject,
            confidence=confidence,
            subject_scores=subject_scores,
            reasoning=reasoning,
            fallback_subjects=fallback_subjects
        )
    
    def _generate_reasoning(self, query: str, predicted_subject: str, scores: Dict[str, float]) -> str:
        """Generate human-readable reasoning for the classification."""
        query_lower = query.lower()
        matched_keywords = []
        
        if predicted_subject in self.subject_keywords:
            for keyword in self.subject_keywords[predicted_subject]:
                if keyword.lower() in query_lower:
                    matched_keywords.append(keyword)
        
        if matched_keywords:
            keywords_str = ", ".join(matched_keywords[:5])  # Show first 5 matches
            reasoning = f"Classified as '{predicted_subject}' based on keywords: {keywords_str}"
        else:
            reasoning = f"Classified as '{predicted_subject}' with low confidence (no strong keyword matches)"
        
        return reasoning
    
    def add_keywords(self, subject: str, keywords: List[str]):
        """Add keywords for a subject."""
        if subject not in self.subject_keywords:
            self.subject_keywords[subject] = []
        
        self.subject_keywords[subject].extend(keywords)
        logger.info(f"Added {len(keywords)} keywords for {subject}")
    
    def remove_keywords(self, subject: str, keywords: List[str]):
        """Remove keywords for a subject."""
        if subject in self.subject_keywords:
            for keyword in keywords:
                if keyword in self.subject_keywords[subject]:
                    self.subject_keywords[subject].remove(keyword)
            
            logger.info(f"Removed {len(keywords)} keywords from {subject}")

class HybridClassifier(BaseQueryClassifier):
    """
    Hybrid classifier combining multiple classification methods.
    """
    
    def __init__(
        self,
        subjects: List[str],
        confidence_threshold: float = 0.6,
        use_keywords: bool = True,
        use_patterns: bool = True,
        use_length_heuristics: bool = True
    ):
        super().__init__(subjects, confidence_threshold)
        
        self.use_keywords = use_keywords
        self.use_patterns = use_patterns
        self.use_length_heuristics = use_length_heuristics
        
        # Initialize sub-classifiers
        if use_keywords:
            self.keyword_classifier = KeywordClassifier(subjects, confidence_threshold)
        
        # Pattern-based classification
        self.patterns = self._initialize_patterns()
        
    def _initialize_patterns(self) -> Dict[str, List[str]]:
        """Initialize regex patterns for each subject."""
        patterns = {
            "mathematics": [
                r'\b\d+\s*[+\-*/]\s*\d+\b',  # Basic arithmetic
                r'\b\d+\s*=\s*\d+\b',        # Equations
                r'\bx\s*[+\-*/=]\s*\d+\b',   # Algebra
                r'\b\d+\s*%\b',              # Percentages
                r'\b\d+\.\d+\b',             # Decimals
                r'\b\d+/\d+\b',              # Fractions
            ],
            
            "programming": [
                r'\bdef\s+\w+\s*\(',         # Function definitions
                r'\bclass\s+\w+\s*:',        # Class definitions
                r'\bimport\s+\w+',           # Import statements
                r'\bprint\s*\(',             # Print statements
                r'\bif\s+.*:',               # If statements
                r'\bfor\s+\w+\s+in\s+',     # For loops
                r'\b\w+\s*=\s*\[.*\]',      # List assignments
            ],
            
            "science": [
                r'\b\d+\s*°[CF]\b',          # Temperature
                r'\b\d+\s*kg\b',             # Mass units
                r'\b\d+\s*m/s\b',            # Velocity units
                r'\bH2O\b',                  # Chemical formulas
                r'\bCO2\b',
                r'\bNaCl\b',
            ],
            
            "history": [
                r'\b\d{4}\s*(AD|BC|CE|BCE)\b',  # Years
                r'\b\d{1,2}(st|nd|rd|th)\s+century\b',  # Centuries
                r'\bWorld\s+War\s+[I1V2]\b',    # World Wars
            ],
            
            "literature": [
                r'"[^"]*"',                  # Quoted text
                r'\b\w+\s+wrote\s+',         # Author references
                r'\bchapter\s+\d+\b',        # Chapter references
                r'\bpoem\s+by\s+\w+',       # Poem references
            ]
        }
        
        return patterns
    
    def classify(self, query: str) -> ClassificationResult:
        """Classify using hybrid approach."""
        all_scores = defaultdict(list)
        all_reasoning = []
        
        # Keyword-based classification
        if self.use_keywords:
            keyword_result = self.keyword_classifier.classify(query)
            for subject, score in keyword_result.subject_scores.items():
                all_scores[subject].append(score * 0.6)  # Weight: 60%
            all_reasoning.append(f"Keywords: {keyword_result.reasoning}")
        
        # Pattern-based classification
        if self.use_patterns:
            pattern_scores = self._classify_by_patterns(query)
            for subject, score in pattern_scores.items():
                all_scores[subject].append(score * 0.3)  # Weight: 30%
            all_reasoning.append("Patterns: Analyzed query structure")
        
        # Length and complexity heuristics
        if self.use_length_heuristics:
            heuristic_scores = self._classify_by_heuristics(query)
            for subject, score in heuristic_scores.items():
                all_scores[subject].append(score * 0.1)  # Weight: 10%
            all_reasoning.append("Heuristics: Analyzed query characteristics")
        
        # Combine scores
        final_scores = {}
        for subject in self.subjects:
            if subject in all_scores:
                final_scores[subject] = np.mean(all_scores[subject])
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
        
        # Generate combined reasoning
        reasoning = " | ".join(all_reasoning)
        
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
    
    def _classify_by_patterns(self, query: str) -> Dict[str, float]:
        """Classify using regex patterns."""
        scores = {subject: 0.0 for subject in self.subjects}
        
        for subject, patterns in self.patterns.items():
            if subject in scores:
                matches = 0
                for pattern in patterns:
                    if re.search(pattern, query, re.IGNORECASE):
                        matches += 1
                
                if patterns:  # Avoid division by zero
                    scores[subject] = matches / len(patterns)
        
        return scores
    
    def _classify_by_heuristics(self, query: str) -> Dict[str, float]:
        """Classify using length and complexity heuristics."""
        scores = {subject: 0.0 for subject in self.subjects}
        
        query_length = len(query.split())
        has_numbers = bool(re.search(r'\d', query))
        has_symbols = bool(re.search(r'[+\-*/=<>]', query))
        question_words = ['what', 'how', 'why', 'when', 'where', 'who']
        has_question_word = any(word in query.lower() for word in question_words)
        
        # Mathematics: often has numbers and symbols
        if has_numbers and has_symbols:
            scores["mathematics"] += 0.5
        elif has_numbers:
            scores["mathematics"] += 0.2
        
        # Programming: often has specific syntax
        if has_symbols and not has_question_word:
            scores["programming"] += 0.3
        
        # Literature: often longer queries
        if query_length > 10:
            scores["literature"] += 0.2
        
        # Science: moderate length with technical terms
        if 5 <= query_length <= 15:
            scores["science"] += 0.1
        
        # History: often has dates or time references
        if re.search(r'\b\d{4}\b', query):  # Year pattern
            scores["history"] += 0.3
        
        return scores
