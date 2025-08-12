#!/usr/bin/env python3
"""
MCP Context Manager
Handles context persistence and memory management for agents
"""

import json
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import logging
import hashlib
import re
from collections import Counter
import math

logger = logging.getLogger(__name__)

@dataclass
class ContextEntry:
    """Single context entry"""
    timestamp: str
    role: str
    content: str
    agent_type: str
    metadata: Dict[str, Any]

@dataclass
class AgentMemory:
    """Agent memory structure"""
    agent_id: str
    user_id: str
    session_id: str
    created_at: str
    last_updated: str
    conversation_history: List[ContextEntry]
    persistent_memory: Dict[str, Any]
    preferences: Dict[str, Any]
    statistics: Dict[str, Any]
    semantic_index: Dict[str, Any] = None
    summary: str = ""

@dataclass
class SemanticSearchResult:
    """Result from semantic search"""
    entry: ContextEntry
    relevance_score: float
    context_snippet: str

class ContextManager:
    """Manages context and memory for MCP agents"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), 'mcp_context.db')
        self.init_database()
        self.memory_cache = {}
        self.max_history_length = 100
        self.context_retention_days = 30
        self.semantic_cache = {}
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        }
    
    def init_database(self):
        """Initialize SQLite database for context storage"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create contexts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS agent_contexts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    conversation_history TEXT,
                    persistent_memory TEXT,
                    preferences TEXT,
                    statistics TEXT,
                    semantic_index TEXT,
                    summary TEXT,
                    UNIQUE(agent_id, user_id, session_id)
                )
            ''')

            # Check if new columns exist and add them if not
            self._migrate_database(cursor)

            # Create index for faster lookups
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_agent_user_session
                ON agent_contexts(agent_id, user_id, session_id)
            ''')

            conn.commit()
            conn.close()
            logger.info(f"Context database initialized at {self.db_path}")

        except Exception as e:
            logger.error(f"Failed to initialize context database: {e}")

    def _migrate_database(self, cursor):
        """Migrate database schema to add new columns"""
        try:
            # Check if semantic_index column exists
            cursor.execute("PRAGMA table_info(agent_contexts)")
            columns = [column[1] for column in cursor.fetchall()]

            if 'semantic_index' not in columns:
                cursor.execute('ALTER TABLE agent_contexts ADD COLUMN semantic_index TEXT')
                logger.info("Added semantic_index column to database")

            if 'summary' not in columns:
                cursor.execute('ALTER TABLE agent_contexts ADD COLUMN summary TEXT')
                logger.info("Added summary column to database")

        except Exception as e:
            logger.error(f"Database migration failed: {e}")
    
    def get_context(self, agent_id: str, user_id: str, session_id: str) -> Optional[AgentMemory]:
        """Retrieve context for an agent"""
        cache_key = f"{agent_id}_{user_id}_{session_id}"
        
        # Check cache first
        if cache_key in self.memory_cache:
            return self.memory_cache[cache_key]
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT conversation_history, persistent_memory, preferences, statistics,
                       semantic_index, summary, created_at, last_updated
                FROM agent_contexts
                WHERE agent_id = ? AND user_id = ? AND session_id = ?
            ''', (agent_id, user_id, session_id))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                history_json, memory_json, prefs_json, stats_json, semantic_json, summary, created_at, last_updated = result

                # Parse JSON data
                conversation_history = [
                    ContextEntry(**entry) for entry in json.loads(history_json or '[]')
                ]
                persistent_memory = json.loads(memory_json or '{}')
                preferences = json.loads(prefs_json or '{}')
                statistics = json.loads(stats_json or '{}')
                semantic_index = json.loads(semantic_json or '{}')

                memory = AgentMemory(
                    agent_id=agent_id,
                    user_id=user_id,
                    session_id=session_id,
                    created_at=created_at,
                    last_updated=last_updated,
                    conversation_history=conversation_history,
                    persistent_memory=persistent_memory,
                    preferences=preferences,
                    statistics=statistics,
                    semantic_index=semantic_index,
                    summary=summary or ""
                )
                
                # Cache the result
                self.memory_cache[cache_key] = memory
                return memory
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve context: {e}")
            return None
    
    def save_context(self, memory: AgentMemory):
        """Save context to database"""
        cache_key = f"{memory.agent_id}_{memory.user_id}_{memory.session_id}"
        
        try:
            # Limit conversation history length
            if len(memory.conversation_history) > self.max_history_length:
                memory.conversation_history = memory.conversation_history[-self.max_history_length:]
            
            # Update timestamp
            memory.last_updated = datetime.now().isoformat()
            
            # Prepare JSON data
            history_json = json.dumps([asdict(entry) for entry in memory.conversation_history])
            memory_json = json.dumps(memory.persistent_memory)
            prefs_json = json.dumps(memory.preferences)
            stats_json = json.dumps(memory.statistics)
            semantic_json = json.dumps(memory.semantic_index or {})
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Insert or update
            cursor.execute('''
                INSERT OR REPLACE INTO agent_contexts
                (agent_id, user_id, session_id, created_at, last_updated,
                 conversation_history, persistent_memory, preferences, statistics, semantic_index, summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                memory.agent_id, memory.user_id, memory.session_id,
                memory.created_at, memory.last_updated,
                history_json, memory_json, prefs_json, stats_json, semantic_json, memory.summary
            ))
            
            conn.commit()
            conn.close()
            
            # Update cache
            self.memory_cache[cache_key] = memory
            logger.debug(f"Context saved for {cache_key}")
            
        except Exception as e:
            logger.error(f"Failed to save context: {e}")
    
    def create_context(self, agent_id: str, user_id: str, session_id: str) -> AgentMemory:
        """Create new context for an agent"""
        now = datetime.now().isoformat()
        
        memory = AgentMemory(
            agent_id=agent_id,
            user_id=user_id,
            session_id=session_id,
            created_at=now,
            last_updated=now,
            conversation_history=[],
            persistent_memory={},
            preferences={},
            statistics={
                'total_interactions': 0,
                'successful_responses': 0,
                'error_count': 0,
                'average_response_time': 0.0
            },
            semantic_index={},
            summary=""
        )
        
        self.save_context(memory)
        return memory
    
    def add_interaction(self, agent_id: str, user_id: str, session_id: str, 
                       user_message: str, agent_response: str, agent_type: str, 
                       metadata: Dict[str, Any] = None):
        """Add an interaction to the context"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory:
            memory = self.create_context(agent_id, user_id, session_id)
        
        # Add user message
        user_entry = ContextEntry(
            timestamp=datetime.now().isoformat(),
            role='user',
            content=user_message,
            agent_type=agent_type,
            metadata=metadata or {}
        )
        memory.conversation_history.append(user_entry)
        
        # Add agent response
        agent_entry = ContextEntry(
            timestamp=datetime.now().isoformat(),
            role='assistant',
            content=agent_response,
            agent_type=agent_type,
            metadata=metadata or {}
        )
        memory.conversation_history.append(agent_entry)
        
        # Update statistics
        memory.statistics['total_interactions'] += 1
        if metadata and metadata.get('success', True):
            memory.statistics['successful_responses'] += 1
        else:
            memory.statistics['error_count'] += 1

        # Update semantic index with new content
        user_keywords = self._extract_keywords(user_message)
        agent_keywords = self._extract_keywords(agent_response)

        if not memory.semantic_index:
            memory.semantic_index = {}

        # Store keywords for this interaction
        interaction_id = f"interaction_{len(memory.conversation_history)//2}"
        memory.semantic_index[interaction_id] = {
            'user_keywords': user_keywords,
            'agent_keywords': agent_keywords,
            'timestamp': datetime.now().isoformat()
        }

        # Auto-optimize memory if it's getting too large
        if len(memory.conversation_history) > self.max_history_length * 1.2:
            self.optimize_memory(agent_id, user_id, session_id)
        else:
            self.save_context(memory)
    
    def get_conversation_summary(self, agent_id: str, user_id: str, session_id: str, 
                               last_n: int = 10) -> str:
        """Get a summary of recent conversation"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory or not memory.conversation_history:
            return "No previous conversation history."
        
        recent_history = memory.conversation_history[-last_n:]
        summary = "Recent conversation:\n\n"
        
        for entry in recent_history:
            role_emoji = "👤" if entry.role == "user" else "🤖"
            summary += f"{role_emoji} {entry.role.title()}: {entry.content[:100]}...\n"
        
        return summary
    
    def update_preferences(self, agent_id: str, user_id: str, session_id: str, 
                          preferences: Dict[str, Any]):
        """Update user preferences for an agent"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory:
            memory = self.create_context(agent_id, user_id, session_id)
        
        memory.preferences.update(preferences)
        self.save_context(memory)
    
    def cleanup_old_contexts(self):
        """Clean up old contexts beyond retention period"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=self.context_retention_days)).isoformat()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                DELETE FROM agent_contexts 
                WHERE last_updated < ?
            ''', (cutoff_date,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            # Clear cache for deleted contexts
            self.memory_cache.clear()
            
            logger.info(f"Cleaned up {deleted_count} old contexts")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old contexts: {e}")
    
    def get_user_statistics(self, user_id: str) -> Dict[str, Any]:
        """Get statistics for a user across all agents"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT agent_id, statistics 
                FROM agent_contexts 
                WHERE user_id = ?
            ''', (user_id,))
            
            results = cursor.fetchall()
            conn.close()
            
            user_stats = {
                'total_sessions': len(results),
                'agents_used': set(),
                'total_interactions': 0,
                'successful_responses': 0,
                'error_count': 0
            }
            
            for agent_id, stats_json in results:
                user_stats['agents_used'].add(agent_id)
                stats = json.loads(stats_json or '{}')
                user_stats['total_interactions'] += stats.get('total_interactions', 0)
                user_stats['successful_responses'] += stats.get('successful_responses', 0)
                user_stats['error_count'] += stats.get('error_count', 0)
            
            user_stats['agents_used'] = list(user_stats['agents_used'])
            user_stats['success_rate'] = (
                user_stats['successful_responses'] / max(user_stats['total_interactions'], 1)
            ) * 100
            
            return user_stats
            
        except Exception as e:
            logger.error(f"Failed to get user statistics: {e}")
            return {}

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract keywords from text for semantic indexing"""
        # Simple keyword extraction (can be enhanced with NLP libraries)
        text = text.lower()
        # Remove punctuation and split into words
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
        # Filter out stop words
        keywords = [word for word in words if word not in self.stop_words]
        # Return most frequent keywords
        word_counts = Counter(keywords)
        return [word for word, count in word_counts.most_common(20)]

    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using simple TF-IDF approach"""
        # Extract keywords from both texts
        keywords1 = set(self._extract_keywords(text1))
        keywords2 = set(self._extract_keywords(text2))

        if not keywords1 or not keywords2:
            return 0.0

        # Calculate Jaccard similarity
        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)

        return len(intersection) / len(union) if union else 0.0

    def semantic_search(self, agent_id: str, user_id: str, session_id: str,
                       query: str, limit: int = 5) -> List[SemanticSearchResult]:
        """Search conversation history using semantic similarity"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory or not memory.conversation_history:
            return []

        results = []
        query_keywords = self._extract_keywords(query)

        for entry in memory.conversation_history:
            # Calculate relevance score
            similarity = self._calculate_text_similarity(query, entry.content)

            if similarity > 0.1:  # Minimum threshold
                # Create context snippet
                snippet = entry.content[:200] + "..." if len(entry.content) > 200 else entry.content

                results.append(SemanticSearchResult(
                    entry=entry,
                    relevance_score=similarity,
                    context_snippet=snippet
                ))

        # Sort by relevance and return top results
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:limit]

    def generate_conversation_summary(self, agent_id: str, user_id: str, session_id: str) -> str:
        """Generate an intelligent summary of the conversation"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory or not memory.conversation_history:
            return "No conversation history available."

        # Extract key topics and themes
        all_text = " ".join([entry.content for entry in memory.conversation_history])
        keywords = self._extract_keywords(all_text)

        # Group entries by agent type
        topics_by_agent = {}
        for entry in memory.conversation_history:
            agent_type = entry.agent_type
            if agent_type not in topics_by_agent:
                topics_by_agent[agent_type] = []
            topics_by_agent[agent_type].append(entry.content[:100])

        # Generate summary
        summary = f"**Conversation Summary ({len(memory.conversation_history)} messages)**\n\n"

        # Key topics
        if keywords:
            summary += f"**Key Topics:** {', '.join(keywords[:10])}\n\n"

        # Agent interactions
        summary += "**Agent Interactions:**\n"
        for agent_type, messages in topics_by_agent.items():
            summary += f"- {agent_type.title()}: {len(messages)} interactions\n"

        # Recent activity
        if memory.conversation_history:
            recent_entries = memory.conversation_history[-3:]
            summary += "\n**Recent Activity:**\n"
            for entry in recent_entries:
                role_emoji = "👤" if entry.role == "user" else "🤖"
                summary += f"{role_emoji} {entry.content[:100]}...\n"

        return summary

    def optimize_memory(self, agent_id: str, user_id: str, session_id: str):
        """Optimize memory by summarizing old conversations and keeping important context"""
        memory = self.get_context(agent_id, user_id, session_id)
        if not memory or len(memory.conversation_history) <= self.max_history_length:
            return

        # Keep recent conversations
        recent_history = memory.conversation_history[-50:]

        # Summarize older conversations
        older_history = memory.conversation_history[:-50]
        if older_history:
            old_summary = self._summarize_entries(older_history)

            # Store summary in persistent memory
            if 'conversation_summaries' not in memory.persistent_memory:
                memory.persistent_memory['conversation_summaries'] = []

            memory.persistent_memory['conversation_summaries'].append({
                'period': f"{older_history[0].timestamp} to {older_history[-1].timestamp}",
                'summary': old_summary,
                'message_count': len(older_history),
                'created_at': datetime.now().isoformat()
            })

        # Update conversation history with recent messages only
        memory.conversation_history = recent_history

        # Save optimized memory
        self.save_context(memory)

        logger.info(f"Memory optimized for {agent_id}_{user_id}_{session_id}")

    def _summarize_entries(self, entries: List[ContextEntry]) -> str:
        """Create a summary of conversation entries"""
        if not entries:
            return "No entries to summarize."

        # Extract key information
        user_messages = [e.content for e in entries if e.role == "user"]
        agent_messages = [e.content for e in entries if e.role == "assistant"]

        # Get key topics
        all_content = " ".join([e.content for e in entries])
        keywords = self._extract_keywords(all_content)

        summary = f"Summary of {len(entries)} messages:\n"
        summary += f"- User queries: {len(user_messages)}\n"
        summary += f"- Agent responses: {len(agent_messages)}\n"

        if keywords:
            summary += f"- Key topics: {', '.join(keywords[:8])}\n"

        # Add sample interactions
        if user_messages:
            summary += f"- Sample user query: {user_messages[0][:100]}...\n"
        if agent_messages:
            summary += f"- Sample agent response: {agent_messages[0][:100]}...\n"

        return summary

    def get_relevant_context(self, agent_id: str, user_id: str, session_id: str,
                           query: str, max_context: int = 3) -> str:
        """Get relevant context for a query using semantic search"""
        # Search for relevant past conversations
        search_results = self.semantic_search(agent_id, user_id, session_id, query, max_context)

        if not search_results:
            return "No relevant context found."

        context = "**Relevant Context:**\n\n"
        for i, result in enumerate(search_results, 1):
            context += f"{i}. (Relevance: {result.relevance_score:.2f})\n"
            context += f"   {result.context_snippet}\n\n"

        return context

# Global context manager instance
context_manager = ContextManager()

def get_context_manager() -> ContextManager:
    """Get the global context manager instance"""
    return context_manager
