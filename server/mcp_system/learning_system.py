#!/usr/bin/env python3
"""
MCP Agent Learning System
Implements feedback loops and learning mechanisms for continuous improvement
"""

import json
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
from collections import defaultdict, Counter
import statistics

logger = logging.getLogger(__name__)

@dataclass
class FeedbackEntry:
    """User feedback on agent responses"""
    feedback_id: str
    agent_id: str
    user_id: str
    session_id: str
    query: str
    response: str
    rating: int  # 1-5 scale
    feedback_text: Optional[str]
    timestamp: str
    response_metadata: Dict[str, Any]

@dataclass
class LearningPattern:
    """Identified learning pattern"""
    pattern_id: str
    pattern_type: str  # 'query_type', 'response_style', 'tool_usage'
    pattern_data: Dict[str, Any]
    success_rate: float
    confidence: float
    last_updated: str

@dataclass
class AgentPerformanceMetrics:
    """Performance metrics for an agent"""
    agent_id: str
    total_interactions: int
    average_rating: float
    success_rate: float
    improvement_trend: float
    common_issues: List[str]
    strengths: List[str]
    last_updated: str

class AgentLearningSystem:
    """Manages agent learning and improvement"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), 'mcp_learning.db')
        self.init_database()
        self.learning_cache = {}
        self.min_feedback_for_learning = 5
        self.learning_threshold = 0.7
        
    def init_database(self):
        """Initialize learning database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Feedback table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    feedback_id TEXT UNIQUE NOT NULL,
                    agent_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    query TEXT NOT NULL,
                    response TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    feedback_text TEXT,
                    timestamp TEXT NOT NULL,
                    response_metadata TEXT
                )
            ''')
            
            # Learning patterns table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS learning_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_id TEXT UNIQUE NOT NULL,
                    pattern_type TEXT NOT NULL,
                    pattern_data TEXT NOT NULL,
                    success_rate REAL NOT NULL,
                    confidence REAL NOT NULL,
                    last_updated TEXT NOT NULL
                )
            ''')
            
            # Performance metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT UNIQUE NOT NULL,
                    total_interactions INTEGER NOT NULL,
                    average_rating REAL NOT NULL,
                    success_rate REAL NOT NULL,
                    improvement_trend REAL NOT NULL,
                    common_issues TEXT,
                    strengths TEXT,
                    last_updated TEXT NOT NULL
                )
            ''')
            
            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback(agent_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_patterns_type ON learning_patterns(pattern_type)')
            
            conn.commit()
            conn.close()
            logger.info(f"Learning database initialized at {self.db_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize learning database: {e}")
    
    def record_feedback(self, agent_id: str, user_id: str, session_id: str,
                       query: str, response: str, rating: int, 
                       feedback_text: str = None, response_metadata: Dict = None) -> str:
        """Record user feedback on agent response"""
        try:
            feedback_id = f"fb_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(query + response) % 10000}"
            
            feedback = FeedbackEntry(
                feedback_id=feedback_id,
                agent_id=agent_id,
                user_id=user_id,
                session_id=session_id,
                query=query,
                response=response,
                rating=rating,
                feedback_text=feedback_text,
                timestamp=datetime.now().isoformat(),
                response_metadata=response_metadata or {}
            )
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO feedback 
                (feedback_id, agent_id, user_id, session_id, query, response, 
                 rating, feedback_text, timestamp, response_metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                feedback.feedback_id, feedback.agent_id, feedback.user_id,
                feedback.session_id, feedback.query, feedback.response,
                feedback.rating, feedback.feedback_text, feedback.timestamp,
                json.dumps(feedback.response_metadata)
            ))
            
            conn.commit()
            conn.close()
            
            # Trigger learning analysis if enough feedback collected
            self._trigger_learning_analysis(agent_id)
            
            logger.info(f"Feedback recorded: {feedback_id} for agent {agent_id}")
            return feedback_id
            
        except Exception as e:
            logger.error(f"Failed to record feedback: {e}")
            return ""
    
    def _trigger_learning_analysis(self, agent_id: str):
        """Trigger learning analysis for an agent"""
        try:
            feedback_count = self._get_feedback_count(agent_id)
            if feedback_count >= self.min_feedback_for_learning:
                self.analyze_and_learn(agent_id)
        except Exception as e:
            logger.error(f"Failed to trigger learning analysis: {e}")
    
    def _get_feedback_count(self, agent_id: str) -> int:
        """Get total feedback count for an agent"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM feedback WHERE agent_id = ?', (agent_id,))
            count = cursor.fetchone()[0]
            conn.close()
            return count
        except Exception as e:
            logger.error(f"Failed to get feedback count: {e}")
            return 0
    
    def analyze_and_learn(self, agent_id: str) -> Dict[str, Any]:
        """Analyze feedback and extract learning patterns"""
        try:
            # Get recent feedback
            feedback_data = self._get_recent_feedback(agent_id, days=30)
            
            if len(feedback_data) < self.min_feedback_for_learning:
                return {"status": "insufficient_data", "feedback_count": len(feedback_data)}
            
            # Analyze patterns
            patterns = self._extract_learning_patterns(feedback_data)
            
            # Update performance metrics
            metrics = self._calculate_performance_metrics(agent_id, feedback_data)
            self._save_performance_metrics(metrics)
            
            # Save learning patterns
            for pattern in patterns:
                self._save_learning_pattern(pattern)
            
            # Generate improvement recommendations
            recommendations = self._generate_recommendations(agent_id, patterns, metrics)
            
            return {
                "status": "success",
                "patterns_found": len(patterns),
                "performance_metrics": asdict(metrics),
                "recommendations": recommendations
            }
            
        except Exception as e:
            logger.error(f"Learning analysis failed for {agent_id}: {e}")
            return {"status": "error", "error": str(e)}
    
    def _get_recent_feedback(self, agent_id: str, days: int = 30) -> List[FeedbackEntry]:
        """Get recent feedback for an agent"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT feedback_id, agent_id, user_id, session_id, query, response,
                       rating, feedback_text, timestamp, response_metadata
                FROM feedback 
                WHERE agent_id = ? AND timestamp > ?
                ORDER BY timestamp DESC
            ''', (agent_id, cutoff_date))
            
            results = cursor.fetchall()
            conn.close()
            
            feedback_list = []
            for row in results:
                feedback_list.append(FeedbackEntry(
                    feedback_id=row[0],
                    agent_id=row[1],
                    user_id=row[2],
                    session_id=row[3],
                    query=row[4],
                    response=row[5],
                    rating=row[6],
                    feedback_text=row[7],
                    timestamp=row[8],
                    response_metadata=json.loads(row[9] or '{}')
                ))
            
            return feedback_list
            
        except Exception as e:
            logger.error(f"Failed to get recent feedback: {e}")
            return []
    
    def _extract_learning_patterns(self, feedback_data: List[FeedbackEntry]) -> List[LearningPattern]:
        """Extract learning patterns from feedback data"""
        patterns = []
        
        try:
            # Pattern 1: Query type success rates
            query_patterns = self._analyze_query_patterns(feedback_data)
            patterns.extend(query_patterns)
            
            # Pattern 2: Response style preferences
            style_patterns = self._analyze_response_styles(feedback_data)
            patterns.extend(style_patterns)
            
            # Pattern 3: Tool usage effectiveness
            tool_patterns = self._analyze_tool_usage(feedback_data)
            patterns.extend(tool_patterns)
            
        except Exception as e:
            logger.error(f"Failed to extract learning patterns: {e}")
        
        return patterns
    
    def _analyze_query_patterns(self, feedback_data: List[FeedbackEntry]) -> List[LearningPattern]:
        """Analyze patterns in query types and success rates"""
        patterns = []
        
        # Group by query characteristics
        query_groups = defaultdict(list)
        
        for feedback in feedback_data:
            # Simple categorization based on keywords
            query_lower = feedback.query.lower()
            
            if any(word in query_lower for word in ['what', 'define', 'explain']):
                category = 'definition'
            elif any(word in query_lower for word in ['how', 'step', 'process']):
                category = 'procedural'
            elif any(word in query_lower for word in ['code', 'program', 'implement']):
                category = 'coding'
            elif any(word in query_lower for word in ['analyze', 'compare', 'evaluate']):
                category = 'analytical'
            else:
                category = 'general'
            
            query_groups[category].append(feedback)
        
        # Calculate success rates for each category
        for category, feedbacks in query_groups.items():
            if len(feedbacks) >= 3:  # Minimum sample size
                ratings = [f.rating for f in feedbacks]
                success_rate = len([r for r in ratings if r >= 4]) / len(ratings)
                avg_rating = statistics.mean(ratings)
                
                pattern = LearningPattern(
                    pattern_id=f"query_{category}_{datetime.now().strftime('%Y%m%d')}",
                    pattern_type='query_type',
                    pattern_data={
                        'category': category,
                        'sample_size': len(feedbacks),
                        'average_rating': avg_rating,
                        'common_keywords': self._extract_common_keywords([f.query for f in feedbacks])
                    },
                    success_rate=success_rate,
                    confidence=min(len(feedbacks) / 10, 1.0),
                    last_updated=datetime.now().isoformat()
                )
                patterns.append(pattern)
        
        return patterns
    
    def _analyze_response_styles(self, feedback_data: List[FeedbackEntry]) -> List[LearningPattern]:
        """Analyze preferred response styles"""
        patterns = []
        
        # Analyze response characteristics
        style_metrics = defaultdict(list)
        
        for feedback in feedback_data:
            response_length = len(feedback.response.split())
            has_examples = 'example' in feedback.response.lower() or 'for instance' in feedback.response.lower()
            has_structure = any(marker in feedback.response for marker in ['**', '1.', '2.', '-', '•'])
            
            style_key = f"length_{self._categorize_length(response_length)}_examples_{has_examples}_structured_{has_structure}"
            style_metrics[style_key].append(feedback.rating)
        
        # Find best performing styles
        for style, ratings in style_metrics.items():
            if len(ratings) >= 3:
                success_rate = len([r for r in ratings if r >= 4]) / len(ratings)
                
                if success_rate > self.learning_threshold:
                    pattern = LearningPattern(
                        pattern_id=f"style_{style}_{datetime.now().strftime('%Y%m%d')}",
                        pattern_type='response_style',
                        pattern_data={
                            'style_characteristics': style,
                            'sample_size': len(ratings),
                            'average_rating': statistics.mean(ratings)
                        },
                        success_rate=success_rate,
                        confidence=min(len(ratings) / 15, 1.0),
                        last_updated=datetime.now().isoformat()
                    )
                    patterns.append(pattern)
        
        return patterns
    
    def _analyze_tool_usage(self, feedback_data: List[FeedbackEntry]) -> List[LearningPattern]:
        """Analyze tool usage effectiveness"""
        patterns = []
        
        tool_performance = defaultdict(list)
        
        for feedback in feedback_data:
            tools_used = feedback.response_metadata.get('tools_used', [])
            for tool in tools_used:
                tool_performance[tool].append(feedback.rating)
        
        for tool, ratings in tool_performance.items():
            if len(ratings) >= 3:
                success_rate = len([r for r in ratings if r >= 4]) / len(ratings)
                
                pattern = LearningPattern(
                    pattern_id=f"tool_{tool}_{datetime.now().strftime('%Y%m%d')}",
                    pattern_type='tool_usage',
                    pattern_data={
                        'tool_name': tool,
                        'usage_count': len(ratings),
                        'average_rating': statistics.mean(ratings)
                    },
                    success_rate=success_rate,
                    confidence=min(len(ratings) / 10, 1.0),
                    last_updated=datetime.now().isoformat()
                )
                patterns.append(pattern)
        
        return patterns
    
    def _categorize_length(self, word_count: int) -> str:
        """Categorize response length"""
        if word_count < 50:
            return "short"
        elif word_count < 150:
            return "medium"
        else:
            return "long"
    
    def _extract_common_keywords(self, texts: List[str]) -> List[str]:
        """Extract common keywords from a list of texts"""
        all_words = []
        for text in texts:
            words = text.lower().split()
            all_words.extend([w for w in words if len(w) > 3])
        
        word_counts = Counter(all_words)
        return [word for word, count in word_counts.most_common(5)]
    
    def _calculate_performance_metrics(self, agent_id: str, feedback_data: List[FeedbackEntry]) -> AgentPerformanceMetrics:
        """Calculate performance metrics for an agent"""
        ratings = [f.rating for f in feedback_data]
        
        # Calculate metrics
        total_interactions = len(feedback_data)
        average_rating = statistics.mean(ratings) if ratings else 0
        success_rate = len([r for r in ratings if r >= 4]) / len(ratings) if ratings else 0
        
        # Calculate improvement trend (compare recent vs older feedback)
        if len(ratings) >= 10:
            recent_ratings = ratings[:len(ratings)//2]
            older_ratings = ratings[len(ratings)//2:]
            improvement_trend = statistics.mean(recent_ratings) - statistics.mean(older_ratings)
        else:
            improvement_trend = 0.0
        
        # Identify common issues and strengths
        low_rated = [f for f in feedback_data if f.rating <= 2]
        high_rated = [f for f in feedback_data if f.rating >= 4]
        
        common_issues = self._identify_common_themes([f.feedback_text for f in low_rated if f.feedback_text])
        strengths = self._identify_common_themes([f.feedback_text for f in high_rated if f.feedback_text])
        
        return AgentPerformanceMetrics(
            agent_id=agent_id,
            total_interactions=total_interactions,
            average_rating=average_rating,
            success_rate=success_rate,
            improvement_trend=improvement_trend,
            common_issues=common_issues,
            strengths=strengths,
            last_updated=datetime.now().isoformat()
        )
    
    def _identify_common_themes(self, feedback_texts: List[str]) -> List[str]:
        """Identify common themes in feedback text"""
        if not feedback_texts:
            return []
        
        # Simple keyword extraction from feedback
        all_words = []
        for text in feedback_texts:
            if text:
                words = text.lower().split()
                all_words.extend([w for w in words if len(w) > 4])
        
        word_counts = Counter(all_words)
        return [word for word, count in word_counts.most_common(3) if count > 1]
    
    def _save_performance_metrics(self, metrics: AgentPerformanceMetrics):
        """Save performance metrics to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO performance_metrics
                (agent_id, total_interactions, average_rating, success_rate,
                 improvement_trend, common_issues, strengths, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metrics.agent_id, metrics.total_interactions, metrics.average_rating,
                metrics.success_rate, metrics.improvement_trend,
                json.dumps(metrics.common_issues), json.dumps(metrics.strengths),
                metrics.last_updated
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to save performance metrics: {e}")
    
    def _save_learning_pattern(self, pattern: LearningPattern):
        """Save learning pattern to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO learning_patterns
                (pattern_id, pattern_type, pattern_data, success_rate, confidence, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                pattern.pattern_id, pattern.pattern_type, json.dumps(pattern.pattern_data),
                pattern.success_rate, pattern.confidence, pattern.last_updated
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to save learning pattern: {e}")
    
    def _generate_recommendations(self, agent_id: str, patterns: List[LearningPattern], 
                                metrics: AgentPerformanceMetrics) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        # Analyze patterns for recommendations
        for pattern in patterns:
            if pattern.success_rate > 0.8 and pattern.confidence > 0.5:
                if pattern.pattern_type == 'query_type':
                    category = pattern.pattern_data['category']
                    recommendations.append(f"Continue excelling at {category} queries - maintain current approach")
                elif pattern.pattern_type == 'response_style':
                    recommendations.append(f"Effective response style identified - consider applying similar formatting")
                elif pattern.pattern_type == 'tool_usage':
                    tool = pattern.pattern_data['tool_name']
                    recommendations.append(f"Tool '{tool}' shows high success rate - consider using more frequently")
        
        # Performance-based recommendations
        if metrics.average_rating < 3.5:
            recommendations.append("Focus on improving response quality and relevance")
        
        if metrics.improvement_trend < -0.2:
            recommendations.append("Performance declining - review recent changes and user feedback")
        
        if metrics.common_issues:
            recommendations.append(f"Address common issues: {', '.join(metrics.common_issues)}")
        
        return recommendations[:5]  # Limit to top 5 recommendations

# Global learning system instance
learning_system = None

def get_learning_system() -> AgentLearningSystem:
    """Get the global learning system instance"""
    global learning_system
    if learning_system is None:
        learning_system = AgentLearningSystem()
    return learning_system
