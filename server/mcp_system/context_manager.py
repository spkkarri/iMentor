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

class ContextManager:
    """Manages context and memory for MCP agents"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), 'mcp_context.db')
        self.init_database()
        self.memory_cache = {}
        self.max_history_length = 100
        self.context_retention_days = 30
    
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
                    UNIQUE(agent_id, user_id, session_id)
                )
            ''')
            
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
                SELECT conversation_history, persistent_memory, preferences, statistics, created_at, last_updated
                FROM agent_contexts 
                WHERE agent_id = ? AND user_id = ? AND session_id = ?
            ''', (agent_id, user_id, session_id))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                history_json, memory_json, prefs_json, stats_json, created_at, last_updated = result
                
                # Parse JSON data
                conversation_history = [
                    ContextEntry(**entry) for entry in json.loads(history_json or '[]')
                ]
                persistent_memory = json.loads(memory_json or '{}')
                preferences = json.loads(prefs_json or '{}')
                statistics = json.loads(stats_json or '{}')
                
                memory = AgentMemory(
                    agent_id=agent_id,
                    user_id=user_id,
                    session_id=session_id,
                    created_at=created_at,
                    last_updated=last_updated,
                    conversation_history=conversation_history,
                    persistent_memory=persistent_memory,
                    preferences=preferences,
                    statistics=statistics
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
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Insert or update
            cursor.execute('''
                INSERT OR REPLACE INTO agent_contexts 
                (agent_id, user_id, session_id, created_at, last_updated, 
                 conversation_history, persistent_memory, preferences, statistics)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                memory.agent_id, memory.user_id, memory.session_id,
                memory.created_at, memory.last_updated,
                history_json, memory_json, prefs_json, stats_json
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
            }
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

# Global context manager instance
context_manager = ContextManager()

def get_context_manager() -> ContextManager:
    """Get the global context manager instance"""
    return context_manager
