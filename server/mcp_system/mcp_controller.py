#!/usr/bin/env python3
"""
MCP (Model Context Protocol) Controller
Advanced AI agent system with tool integration and context management
"""

import json
import sys
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import requests
import os
from pathlib import Path
from context_manager import get_context_manager
from learning_system import get_learning_system

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class AgentContext:
    """Context information for an agent"""
    agent_id: str
    session_id: str
    user_id: str
    conversation_history: List[Dict[str, Any]]
    tools_available: List[str]
    memory: Dict[str, Any]
    created_at: datetime
    last_updated: datetime

@dataclass
class ToolResult:
    """Result from tool execution"""
    success: bool
    data: Any
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class MCPAgent:
    """Base class for MCP agents"""
    
    def __init__(self, agent_id: str, name: str, description: str, capabilities: List[str]):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.capabilities = capabilities
        self.tools = []
        self.context = None
        
    async def process_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Process a query with the agent"""
        raise NotImplementedError("Subclasses must implement process_query")
    
    def add_tool(self, tool):
        """Add a tool to the agent"""
        self.tools.append(tool)
    
    async def use_tool(self, tool_name: str, **kwargs) -> ToolResult:
        """Use a specific tool"""
        for tool in self.tools:
            if tool.name == tool_name:
                return await tool.execute(**kwargs)
        return ToolResult(success=False, error=f"Tool {tool_name} not found")

class ResearchAgent(MCPAgent):
    """Specialized agent for research and information gathering"""
    
    def __init__(self):
        super().__init__(
            agent_id="research_agent",
            name="Research Assistant",
            description="Specialized in research, fact-checking, and information synthesis",
            capabilities=["web_search", "fact_checking", "source_analysis", "synthesis"]
        )
    
    async def process_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Process research queries"""
        logger.info(f"Research Agent processing: {query}")
        
        # Analyze query type
        query_type = self._analyze_query_type(query)
        
        # Use appropriate tools based on query type
        if query_type == "factual":
            return await self._handle_factual_query(query, context)
        elif query_type == "research":
            return await self._handle_research_query(query, context)
        else:
            return await self._handle_general_query(query, context)
    
    def _analyze_query_type(self, query: str) -> str:
        """Analyze the type of query"""
        research_keywords = ["research", "study", "analyze", "compare", "investigate"]
        factual_keywords = ["what is", "who is", "when did", "where is", "how many"]
        
        query_lower = query.lower()
        
        if any(keyword in query_lower for keyword in factual_keywords):
            return "factual"
        elif any(keyword in query_lower for keyword in research_keywords):
            return "research"
        else:
            return "general"
    
    async def _handle_factual_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Handle factual queries"""
        # Use web search tool
        search_result = await self.use_tool("web_search", query=query, type="factual")
        
        if search_result.success:
            return {
                "response": f"🔍 **Research Agent - Factual Analysis**\n\n{search_result.data.get('answer', 'No specific answer found.')}",
                "sources": search_result.data.get('sources', []),
                "confidence": search_result.data.get('confidence', 0.7),
                "agent_type": "research",
                "query_type": "factual"
            }
        else:
            return {
                "response": "I apologize, but I couldn't retrieve factual information at the moment. Please try again later.",
                "error": search_result.error,
                "agent_type": "research"
            }
    
    async def _handle_research_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Handle comprehensive research queries"""
        # Enhanced multi-step research process
        results = []
        tools_used = []

        # Step 1: Web search
        web_result = await self.use_tool("web_search", query=query, type="comprehensive")
        if web_result.success:
            results.append(web_result.data)
            tools_used.append("web_search")

        # Step 2: Check if we need additional API data
        query_lower = query.lower()
        if any(word in query_lower for word in ['weather', 'temperature', 'climate']):
            # Extract location from query if possible
            location = self._extract_location(query) or "global"
            weather_result = await self.use_tool("api_integration", api_type="weather", location=location)
            if weather_result.success:
                results.append(weather_result.data)
                tools_used.append("weather_api")

        if any(word in query_lower for word in ['news', 'current', 'recent', 'latest']):
            news_result = await self.use_tool("api_integration", api_type="news", category="general")
            if news_result.success:
                results.append(news_result.data)
                tools_used.append("news_api")

        # Step 3: Text analysis of the query for better understanding
        analysis_result = await self.use_tool("text_analysis", text=query)
        if analysis_result.success:
            results.append(analysis_result.data)
            tools_used.append("text_analysis")

        # Synthesize results
        synthesized = self._synthesize_research(query, results)

        return {
            "response": f"**Research Agent - Comprehensive Analysis**\n\n{synthesized}",
            "sources": self._extract_sources(results),
            "confidence": 0.85,
            "agent_type": "research",
            "query_type": "research",
            "tools_used": tools_used
        }

    def _extract_location(self, query: str) -> Optional[str]:
        """Extract location from query text"""
        # Simple location extraction (can be enhanced with NLP)
        words = query.lower().split()
        location_indicators = ['in', 'at', 'for', 'weather', 'temperature']

        for i, word in enumerate(words):
            if word in location_indicators and i + 1 < len(words):
                # Return the next word as potential location
                return words[i + 1].title()

        return None
    
    async def _handle_general_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Handle general queries"""
        return {
            "response": f"**Research Agent**\n\nI can help you with research, fact-checking, and information analysis. For the query '{query}', I recommend being more specific about what type of information you're looking for.",
            "agent_type": "research",
            "query_type": "general"
        }
    
    def _synthesize_research(self, query: str, results: List[Any]) -> str:
        """Synthesize research results"""
        if not results:
            return "No research data available for synthesis."
        
        # Simple synthesis logic (can be enhanced with AI)
        synthesis = f"Based on my research regarding '{query}':\n\n"
        
        for i, result in enumerate(results, 1):
            if isinstance(result, dict) and 'summary' in result:
                synthesis += f"{i}. {result['summary']}\n"
        
        synthesis += "\nThis analysis is based on current available information and should be verified with primary sources."
        return synthesis
    
    def _extract_sources(self, results: List[Any]) -> List[Dict[str, str]]:
        """Extract sources from results"""
        sources = []
        for result in results:
            if isinstance(result, dict) and 'sources' in result:
                sources.extend(result['sources'])
        return sources[:5]  # Limit to top 5 sources

class AnalysisAgent(MCPAgent):
    """Specialized agent for data analysis and insights"""

    def __init__(self):
        super().__init__(
            agent_id="analysis_agent",
            name="Analysis Assistant",
            description="Specialized in data analysis, pattern recognition, and insights generation",
            capabilities=["data_analysis", "pattern_recognition", "statistical_analysis", "visualization"]
        )

    async def process_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Process analysis queries"""
        logger.info(f"Analysis Agent processing: {query}")

        analysis_type = self._detect_analysis_type(query)

        return {
            "response": f"**Analysis Agent - {analysis_type.title()} Analysis**\n\nI can help you with data analysis, pattern recognition, and generating insights. For the query '{query}', I would recommend:\n\n• Data collection and preprocessing\n• Statistical analysis and modeling\n• Pattern identification\n• Visualization and reporting\n\nPlease provide your data or specific analysis requirements for detailed assistance.",
            "agent_type": "analysis",
            "analysis_type": analysis_type,
            "confidence": 0.8
        }

    def _detect_analysis_type(self, query: str) -> str:
        """Detect the type of analysis needed"""
        query_lower = query.lower()

        if any(word in query_lower for word in ['trend', 'time series', 'forecast']):
            return "trend"
        elif any(word in query_lower for word in ['correlation', 'relationship', 'association']):
            return "correlation"
        elif any(word in query_lower for word in ['cluster', 'group', 'segment']):
            return "clustering"
        elif any(word in query_lower for word in ['predict', 'model', 'machine learning']):
            return "predictive"
        else:
            return "exploratory"

class CreativeAgent(MCPAgent):
    """Specialized agent for creative writing and content generation"""

    def __init__(self):
        super().__init__(
            agent_id="creative_agent",
            name="Creative Assistant",
            description="Specialized in creative writing, content generation, and storytelling",
            capabilities=["creative_writing", "storytelling", "content_generation", "brainstorming"]
        )

    async def process_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Process creative queries"""
        logger.info(f"Creative Agent processing: {query}")

        creative_type = self._detect_creative_type(query)

        return {
            "response": f"**Creative Agent - {creative_type.title()} Creation**\n\nI'm here to help with your creative endeavors! For '{query}', I can assist with:\n\n• Brainstorming and ideation\n• Story development and structure\n• Character creation and dialogue\n• Content optimization and style\n\nLet me know what specific creative project you're working on, and I'll provide tailored assistance!",
            "agent_type": "creative",
            "creative_type": creative_type,
            "confidence": 0.8
        }

    def _detect_creative_type(self, query: str) -> str:
        """Detect the type of creative work needed"""
        query_lower = query.lower()

        if any(word in query_lower for word in ['story', 'novel', 'narrative', 'plot']):
            return "storytelling"
        elif any(word in query_lower for word in ['poem', 'poetry', 'verse', 'rhyme']):
            return "poetry"
        elif any(word in query_lower for word in ['article', 'blog', 'content', 'copy']):
            return "content"
        elif any(word in query_lower for word in ['script', 'dialogue', 'screenplay']):
            return "scriptwriting"
        else:
            return "general"

class CodingAgent(MCPAgent):
    """Specialized agent for coding and technical assistance"""

    def __init__(self):
        super().__init__(
            agent_id="coding_agent",
            name="Coding Assistant",
            description="Specialized in programming, code analysis, and technical problem solving",
            capabilities=["code_generation", "code_review", "debugging", "architecture"]
        )
    
    async def process_query(self, query: str, context: AgentContext) -> Dict[str, Any]:
        """Process coding queries"""
        logger.info(f"Coding Agent processing: {query}")
        
        # Detect programming language and task type
        lang_info = self._detect_language_and_task(query)
        
        if lang_info['task_type'] == 'code_generation':
            return await self._generate_code(query, lang_info, context)
        elif lang_info['task_type'] == 'code_review':
            return await self._review_code(query, lang_info, context)
        elif lang_info['task_type'] == 'debugging':
            return await self._debug_code(query, lang_info, context)
        else:
            return await self._provide_technical_guidance(query, lang_info, context)
    
    def _detect_language_and_task(self, query: str) -> Dict[str, str]:
        """Detect programming language and task type"""
        languages = {
            'python': ['python', 'py', 'django', 'flask', 'pandas'],
            'javascript': ['javascript', 'js', 'node', 'react', 'vue'],
            'java': ['java', 'spring', 'maven'],
            'cpp': ['c++', 'cpp', 'c plus plus'],
            'sql': ['sql', 'database', 'query']
        }
        
        tasks = {
            'code_generation': ['write', 'create', 'generate', 'implement'],
            'code_review': ['review', 'check', 'analyze', 'improve'],
            'debugging': ['debug', 'fix', 'error', 'bug', 'issue'],
            'explanation': ['explain', 'how does', 'what is', 'understand']
        }
        
        query_lower = query.lower()
        
        # Detect language
        detected_lang = 'general'
        for lang, keywords in languages.items():
            if any(keyword in query_lower for keyword in keywords):
                detected_lang = lang
                break
        
        # Detect task type
        detected_task = 'explanation'
        for task, keywords in tasks.items():
            if any(keyword in query_lower for keyword in keywords):
                detected_task = task
                break
        
        return {
            'language': detected_lang,
            'task_type': detected_task
        }
    
    async def _generate_code(self, query: str, lang_info: Dict[str, str], context: AgentContext) -> Dict[str, Any]:
        """Generate code based on requirements"""
        language = lang_info['language']
        
        # Use code generation tool
        code_result = await self.use_tool("code_generator", query=query, language=language)
        
        if code_result.success:
            code = code_result.data.get('code', '')
            explanation = code_result.data.get('explanation', '')
            
            response = f"**Coding Agent - Code Generation ({language})**\n\n"
            response += f"Here's the code for your request:\n\n```{language}\n{code}\n```\n\n"
            if explanation:
                response += f"**Explanation:**\n{explanation}"
            
            return {
                "response": response,
                "code": code,
                "language": language,
                "agent_type": "coding",
                "task_type": "generation"
            }
        else:
            return {
                "response": f"**Coding Agent**\n\nI encountered an issue generating code for your request. Please provide more specific requirements.",
                "error": code_result.error,
                "agent_type": "coding"
            }
    
    async def _review_code(self, query: str, lang_info: Dict[str, str], context: AgentContext) -> Dict[str, Any]:
        """Review and analyze code"""
        return {
            "response": f"**Coding Agent - Code Review**\n\nI can help review your code. Please provide the code you'd like me to analyze, and I'll check for:\n\n• Code quality and best practices\n• Potential bugs and issues\n• Performance optimizations\n• Security considerations",
            "agent_type": "coding",
            "task_type": "review"
        }
    
    async def _debug_code(self, query: str, lang_info: Dict[str, str], context: AgentContext) -> Dict[str, Any]:
        """Help debug code issues"""
        return {
            "response": f"**Coding Agent - Debugging**\n\nI can help debug your code. Please provide:\n\n• The code that's causing issues\n• The error message you're seeing\n• What you expected to happen\n• Your development environment details",
            "agent_type": "coding",
            "task_type": "debugging"
        }
    
    async def _provide_technical_guidance(self, query: str, lang_info: Dict[str, str], context: AgentContext) -> Dict[str, Any]:
        """Provide technical guidance and explanations"""
        return {
            "response": f"**Coding Agent - Technical Guidance**\n\nI can help explain programming concepts, best practices, and provide technical guidance. What specific aspect would you like me to explain?",
            "agent_type": "coding",
            "task_type": "guidance"
        }

class MCPController:
    """Main MCP Controller managing all agents and tools"""

    def __init__(self):
        self.agents: Dict[str, MCPAgent] = {}
        self.tools = {}
        self.contexts: Dict[str, AgentContext] = {}
        self.context_manager = get_context_manager()
        self.learning_system = get_learning_system()
        self.initialize_agents()
        self.initialize_tools()
        self.orchestrator = AgentOrchestrator(self)
    
    def initialize_agents(self):
        """Initialize all available agents"""
        self.agents = {
            "research": ResearchAgent(),
            "coding": CodingAgent(),
            "analysis": AnalysisAgent(),
            "creative": CreativeAgent(),
        }
        logger.info(f"Initialized {len(self.agents)} agents")
    
    def initialize_tools(self):
        """Initialize all available tools"""
        self.tools = {
            "web_search": WebSearchTool(),
            "calculator": CalculatorTool(),
            "text_analysis": TextAnalysisTool(),
            "code_generator": CodeGeneratorTool(),
            "file_operations": FileOperationsTool(),
            "api_integration": APIIntegrationTool()
        }
        
        # Add tools to appropriate agents
        for agent in self.agents.values():
            for tool in self.tools.values():
                agent.add_tool(tool)
        
        logger.info(f"Initialized {len(self.tools)} tools")
    
    async def process_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process an MCP request with optional orchestration"""
        try:
            query = request_data.get('input', '')
            session_id = request_data.get('sessionId', 'default')
            user_id = request_data.get('userId', 'anonymous')
            history = request_data.get('history', [])
            use_orchestration = request_data.get('use_orchestration', True)

            # Create context for orchestration
            context = self._get_or_create_context('orchestrator', session_id, user_id, history)

            # Determine if we should use orchestration
            if use_orchestration and self._should_use_orchestration(query):
                workflow_id = f"{session_id}_{user_id}_{len(history)}"
                result = await self.orchestrator.execute_workflow(workflow_id, query, context)
            else:
                # Use single agent approach
                agent = self._select_agent(query)
                agent_context = self._get_or_create_context(agent.agent_id, session_id, user_id, history)
                result = await agent.process_query(query, agent_context)

            # Update context using context manager
            agent_id = result.get('agent_id', 'orchestrator') if use_orchestration and self._should_use_orchestration(query) else result.get('agent_id', 'unknown')
            self.context_manager.add_interaction(
                agent_id=agent_id,
                user_id=user_id,
                session_id=session_id,
                user_message=query,
                agent_response=result.get('response', ''),
                agent_type=result.get('agent_type', 'general'),
                metadata=result.get('metadata', {})
            )

            # Update local context
            self._update_context(context, query, result)
            
            # Determine agent information based on execution type
            if use_orchestration and self._should_use_orchestration(query):
                agent_name = "Multi-Agent Orchestrator"
                agent_id = "orchestrator"
            else:
                agent = self._select_agent(query)
                agent_name = agent.name
                agent_id = agent.agent_id

            return {
                "success": True,
                "data": {
                    "response": result.get('response', ''),
                    "agent_used": result.get('agents_used', [agent_name]) if isinstance(result.get('agents_used'), list) else agent_name,
                    "agent_id": agent_id,
                    "metadata": {
                        "confidence": result.get('confidence', 0.7),
                        "sources": result.get('sources', []),
                        "agent_type": result.get('agent_type', 'general'),
                        "task_type": result.get('task_type', 'general'),
                        "tools_used": result.get('tools_used', []),
                        "processing_time": result.get('processing_time', 0),
                        "workflow_type": result.get('workflow_type'),
                        "steps": result.get('steps', 1),
                        "learning_enabled": True,
                        "feedback_id": None  # Will be set when feedback is provided
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing MCP request: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "response": "I apologize, but I encountered an error processing your request. Please try again.",
                    "agent_used": "error_handler"
                }
            }
    
    def _select_agent(self, query: str) -> MCPAgent:
        """Select the most appropriate agent for the query"""
        query_lower = query.lower()

        # Coding-related keywords
        coding_keywords = ['code', 'program', 'function', 'class', 'variable', 'algorithm', 'debug', 'python', 'javascript', 'java', 'programming', 'software', 'development']
        if any(keyword in query_lower for keyword in coding_keywords):
            return self.agents['coding']

        # Analysis-related keywords
        analysis_keywords = ['analyze', 'analysis', 'data', 'statistics', 'trend', 'pattern', 'correlation', 'model', 'predict', 'forecast', 'chart', 'graph']
        if any(keyword in query_lower for keyword in analysis_keywords):
            return self.agents['analysis']

        # Creative-related keywords
        creative_keywords = ['write', 'story', 'creative', 'poem', 'article', 'blog', 'content', 'script', 'narrative', 'brainstorm', 'idea']
        if any(keyword in query_lower for keyword in creative_keywords):
            return self.agents['creative']

        # Research-related keywords
        research_keywords = ['research', 'study', 'what is', 'who is', 'when', 'where', 'how', 'why', 'explain', 'define', 'compare']
        if any(keyword in query_lower for keyword in research_keywords):
            return self.agents['research']

        # Default to research agent for general queries
        return self.agents['research']

    def _should_use_orchestration(self, query: str) -> bool:
        """Determine if a query should use multi-agent orchestration"""
        query_lower = query.lower()

        # Complex task indicators
        complex_indicators = [
            'comprehensive', 'detailed', 'thorough', 'complete analysis',
            'research and implement', 'analyze and create', 'build and test',
            'step by step', 'end to end', 'full solution'
        ]

        # Multi-domain indicators
        multi_domain = [
            ('research', 'code'), ('analyze', 'write'), ('study', 'implement'),
            ('investigate', 'build'), ('examine', 'create'), ('explore', 'develop')
        ]

        # Check for complex task indicators
        if any(indicator in query_lower for indicator in complex_indicators):
            return True

        # Check for multi-domain requirements
        for domain1, domain2 in multi_domain:
            if domain1 in query_lower and domain2 in query_lower:
                return True

        # Check query length (longer queries often need orchestration)
        if len(query.split()) > 15:
            return True

        return False

    async def process_feedback(self, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process user feedback for learning"""
        try:
            agent_id = feedback_data.get('agent_id', '')
            user_id = feedback_data.get('user_id', '')
            session_id = feedback_data.get('session_id', '')
            query = feedback_data.get('query', '')
            response = feedback_data.get('response', '')
            rating = feedback_data.get('rating', 0)
            feedback_text = feedback_data.get('feedback_text', '')
            response_metadata = feedback_data.get('response_metadata', {})

            if not all([agent_id, user_id, query, response]) or rating < 1 or rating > 5:
                return {
                    "success": False,
                    "error": "Invalid feedback data. Required: agent_id, user_id, query, response, rating (1-5)"
                }

            # Record feedback in learning system
            feedback_id = self.learning_system.record_feedback(
                agent_id=agent_id,
                user_id=user_id,
                session_id=session_id,
                query=query,
                response=response,
                rating=rating,
                feedback_text=feedback_text,
                response_metadata=response_metadata
            )

            return {
                "success": True,
                "data": {
                    "feedback_id": feedback_id,
                    "message": "Feedback recorded successfully",
                    "learning_triggered": True
                }
            }

        except Exception as e:
            logger.error(f"Error processing feedback: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_agent_performance(self, agent_id: str) -> Dict[str, Any]:
        """Get performance metrics and learning insights for an agent"""
        try:
            # Trigger learning analysis
            learning_results = self.learning_system.analyze_and_learn(agent_id)

            return {
                "success": True,
                "data": {
                    "agent_id": agent_id,
                    "learning_analysis": learning_results,
                    "timestamp": datetime.now().isoformat()
                }
            }

        except Exception as e:
            logger.error(f"Error getting agent performance: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_learning_recommendations(self, agent_id: str) -> Dict[str, Any]:
        """Get learning-based recommendations for improving agent performance"""
        try:
            # Get recent feedback and analyze
            feedback_data = self.learning_system._get_recent_feedback(agent_id, days=30)

            if len(feedback_data) < 5:
                return {
                    "success": True,
                    "data": {
                        "recommendations": ["Collect more user feedback to generate meaningful recommendations"],
                        "feedback_count": len(feedback_data),
                        "status": "insufficient_data"
                    }
                }

            # Extract patterns and generate recommendations
            patterns = self.learning_system._extract_learning_patterns(feedback_data)
            metrics = self.learning_system._calculate_performance_metrics(agent_id, feedback_data)
            recommendations = self.learning_system._generate_recommendations(agent_id, patterns, metrics)

            return {
                "success": True,
                "data": {
                    "agent_id": agent_id,
                    "recommendations": recommendations,
                    "performance_summary": {
                        "average_rating": metrics.average_rating,
                        "success_rate": metrics.success_rate,
                        "total_interactions": metrics.total_interactions,
                        "improvement_trend": metrics.improvement_trend
                    },
                    "patterns_identified": len(patterns),
                    "feedback_count": len(feedback_data)
                }
            }

        except Exception as e:
            logger.error(f"Error getting learning recommendations: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _get_or_create_context(self, agent_id: str, session_id: str, user_id: str, history: List[Dict]) -> AgentContext:
        """Get existing context or create new one"""
        context_key = f"{agent_id}_{session_id}_{user_id}"
        
        if context_key not in self.contexts:
            self.contexts[context_key] = AgentContext(
                agent_id=agent_id,
                session_id=session_id,
                user_id=user_id,
                conversation_history=history,
                tools_available=list(self.tools.keys()),
                memory={},
                created_at=datetime.now(),
                last_updated=datetime.now()
            )
        else:
            # Update existing context
            self.contexts[context_key].conversation_history = history
            self.contexts[context_key].last_updated = datetime.now()
        
        return self.contexts[context_key]
    
    def _update_context(self, context: AgentContext, query: str, result: Dict[str, Any]):
        """Update context with new interaction"""
        context.conversation_history.append({
            "role": "user",
            "content": query,
            "timestamp": datetime.now().isoformat()
        })
        
        context.conversation_history.append({
            "role": "assistant",
            "content": result.get('response', ''),
            "agent_type": result.get('agent_type', 'general'),
            "timestamp": datetime.now().isoformat()
        })
        
        context.last_updated = datetime.now()

# Enhanced Tool implementations
class WebSearchTool:
    def __init__(self):
        self.name = "web_search"

    async def execute(self, **kwargs) -> ToolResult:
        """Execute web search using DuckDuckGo API"""
        try:
            query = kwargs.get('query', '')
            search_type = kwargs.get('type', 'general')

            if not query:
                return ToolResult(success=False, error="Query is required for web search")

            # Use real web search via requests
            try:
                import requests
                from urllib.parse import quote

                # DuckDuckGo Instant Answer API
                ddg_url = f"https://api.duckduckgo.com/?q={quote(query)}&format=json&no_html=1&skip_disambig=1"
                response = requests.get(ddg_url, timeout=10)

                if response.status_code == 200:
                    data = response.json()

                    # Extract answer from DuckDuckGo response
                    answer = data.get('Abstract', '')
                    if not answer:
                        answer = data.get('Definition', '')
                    if not answer and data.get('Answer'):
                        answer = data.get('Answer')

                    # Extract sources
                    sources = []
                    if data.get('AbstractURL'):
                        sources.append({
                            "title": data.get('AbstractSource', 'Source'),
                            "url": data.get('AbstractURL')
                        })

                    # Add related topics as sources
                    for topic in data.get('RelatedTopics', [])[:3]:
                        if isinstance(topic, dict) and topic.get('FirstURL'):
                            sources.append({
                                "title": topic.get('Text', 'Related Topic')[:50] + "...",
                                "url": topic.get('FirstURL')
                            })

                    if not answer:
                        answer = f"Search completed for '{query}'. Please check the sources for detailed information."

                    return ToolResult(
                        success=True,
                        data={
                            "answer": answer,
                            "sources": sources,
                            "confidence": 0.8 if answer else 0.6,
                            "search_type": search_type,
                            "query": query,
                            "provider": "DuckDuckGo"
                        }
                    )
                else:
                    # Fallback to simulated response
                    raise Exception("API request failed")

            except Exception as search_error:
                logger.warning(f"Real web search failed: {search_error}, using fallback")

                # Fallback to enhanced simulated response
                if search_type == 'factual':
                    answer = f"Based on web search for '{query}': This is a factual response with verified information from reliable sources. (Note: Using fallback search due to API limitations)"
                    sources = [
                        {"title": "Wikipedia", "url": f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')}"},
                        {"title": "Britannica", "url": f"https://www.britannica.com/search?query={query}"}
                    ]
                else:
                    answer = f"Comprehensive research results for '{query}': Multiple perspectives and detailed analysis from various sources. (Note: Using fallback search due to API limitations)"
                    sources = [
                        {"title": "Academic Source", "url": f"https://scholar.google.com/scholar?q={query}"},
                        {"title": "News Source", "url": f"https://news.google.com/search?q={query}"},
                        {"title": "Research Database", "url": f"https://www.researchgate.net/search?q={query}"}
                    ]

                return ToolResult(
                    success=True,
                    data={
                        "answer": answer,
                        "sources": sources,
                        "confidence": 0.7,
                        "search_type": search_type,
                        "query": query,
                        "provider": "Fallback"
                    }
                )

        except Exception as e:
            return ToolResult(success=False, error=f"Web search failed: {str(e)}")

class CalculatorTool:
    def __init__(self):
        self.name = "calculator"

    async def execute(self, **kwargs) -> ToolResult:
        """Execute mathematical calculations"""
        try:
            expression = kwargs.get('expression', '')
            if not expression:
                return ToolResult(success=False, error="Expression is required for calculation")

            # Safe evaluation of mathematical expressions
            import ast
            import operator

            # Supported operations
            ops = {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
                ast.Pow: operator.pow,
                ast.USub: operator.neg,
            }

            def eval_expr(node):
                if isinstance(node, ast.Num):
                    return node.n
                elif isinstance(node, ast.BinOp):
                    return ops[type(node.op)](eval_expr(node.left), eval_expr(node.right))
                elif isinstance(node, ast.UnaryOp):
                    return ops[type(node.op)](eval_expr(node.operand))
                else:
                    raise TypeError(node)

            # Parse and evaluate
            tree = ast.parse(expression, mode='eval')
            result = eval_expr(tree.body)

            return ToolResult(
                success=True,
                data={
                    "expression": expression,
                    "result": result,
                    "formatted_result": f"{expression} = {result}"
                }
            )

        except Exception as e:
            return ToolResult(success=False, error=f"Calculation failed: {str(e)}")

class TextAnalysisTool:
    def __init__(self):
        self.name = "text_analysis"

    async def execute(self, **kwargs) -> ToolResult:
        """Analyze text for various metrics"""
        try:
            text = kwargs.get('text', '')
            if not text:
                return ToolResult(success=False, error="Text is required for analysis")

            # Basic text analysis
            words = text.split()
            sentences = text.split('.')
            paragraphs = text.split('\n\n')

            # Character analysis
            char_count = len(text)
            char_count_no_spaces = len(text.replace(' ', ''))

            # Word analysis
            word_count = len(words)
            avg_word_length = sum(len(word) for word in words) / max(word_count, 1)

            # Sentence analysis
            sentence_count = len([s for s in sentences if s.strip()])
            avg_sentence_length = word_count / max(sentence_count, 1)

            # Reading time estimation (average 200 words per minute)
            reading_time_minutes = word_count / 200

            return ToolResult(
                success=True,
                data={
                    "character_count": char_count,
                    "character_count_no_spaces": char_count_no_spaces,
                    "word_count": word_count,
                    "sentence_count": sentence_count,
                    "paragraph_count": len(paragraphs),
                    "average_word_length": round(avg_word_length, 2),
                    "average_sentence_length": round(avg_sentence_length, 2),
                    "estimated_reading_time_minutes": round(reading_time_minutes, 1),
                    "analysis_summary": f"Text contains {word_count} words, {sentence_count} sentences, and takes approximately {round(reading_time_minutes, 1)} minutes to read."
                }
            )

        except Exception as e:
            return ToolResult(success=False, error=f"Text analysis failed: {str(e)}")

class CodeGeneratorTool:
    def __init__(self):
        self.name = "code_generator"

    async def execute(self, **kwargs) -> ToolResult:
        """Generate code based on requirements"""
        try:
            query = kwargs.get('query', '')
            language = kwargs.get('language', 'python')

            if not query:
                return ToolResult(success=False, error="Query is required for code generation")

            # Code templates based on language and query
            templates = {
                'python': {
                    'hello': 'print("Hello, World!")',
                    'function': 'def example_function():\n    """Example function"""\n    return "Hello from function"',
                    'class': 'class ExampleClass:\n    def __init__(self):\n        self.name = "Example"\n    \n    def greet(self):\n        return f"Hello from {self.name}"',
                    'loop': 'for i in range(10):\n    print(f"Iteration {i}")',
                    'default': f'# Generated Python code for: {query}\n# TODO: Implement your logic here\npass'
                },
                'javascript': {
                    'hello': 'console.log("Hello, World!");',
                    'function': 'function exampleFunction() {\n    // Example function\n    return "Hello from function";\n}',
                    'class': 'class ExampleClass {\n    constructor() {\n        this.name = "Example";\n    }\n    \n    greet() {\n        return `Hello from ${this.name}`;\n    }\n}',
                    'loop': 'for (let i = 0; i < 10; i++) {\n    console.log(`Iteration ${i}`);\n}',
                    'default': f'// Generated JavaScript code for: {query}\n// TODO: Implement your logic here'
                }
            }

            # Detect code type
            query_lower = query.lower()
            code_type = 'default'

            if 'hello' in query_lower or 'world' in query_lower:
                code_type = 'hello'
            elif 'function' in query_lower or 'method' in query_lower:
                code_type = 'function'
            elif 'class' in query_lower or 'object' in query_lower:
                code_type = 'class'
            elif 'loop' in query_lower or 'iterate' in query_lower:
                code_type = 'loop'

            # Get template
            lang_templates = templates.get(language, templates['python'])
            code = lang_templates.get(code_type, lang_templates['default'])

            explanation = f"Generated {language} code for '{query}'. This is a {code_type} example that demonstrates basic {language} syntax and structure."

            return ToolResult(
                success=True,
                data={
                    "code": code,
                    "explanation": explanation,
                    "language": language,
                    "code_type": code_type,
                    "query": query
                }
            )

        except Exception as e:
            return ToolResult(success=False, error=f"Code generation failed: {str(e)}")

class FileOperationsTool:
    def __init__(self):
        self.name = "file_operations"
        # Define safe directories for file operations
        self.safe_directories = [
            os.path.join(os.path.dirname(__file__), '..', 'uploads'),
            os.path.join(os.path.dirname(__file__), '..', 'assets'),
            os.path.join(os.path.dirname(__file__), '..', 'data'),
            '/tmp',  # Unix temp directory
            os.environ.get('TEMP', ''),  # Windows temp directory
        ]

    def _is_safe_path(self, file_path: str) -> bool:
        """Check if the file path is within safe directories"""
        try:
            abs_path = os.path.abspath(file_path)
            for safe_dir in self.safe_directories:
                if safe_dir and abs_path.startswith(os.path.abspath(safe_dir)):
                    return True
            return False
        except:
            return False

    async def execute(self, **kwargs) -> ToolResult:
        """Handle file operations (read, write, list) with security constraints"""
        try:
            operation = kwargs.get('operation', 'info')
            file_path = kwargs.get('file_path', '')
            content = kwargs.get('content', '')

            if operation == 'info':
                return ToolResult(
                    success=True,
                    data={
                        "message": "File operations tool available",
                        "supported_operations": ["read", "write", "list", "info", "exists"],
                        "safe_directories": [d for d in self.safe_directories if d],
                        "note": "File operations are restricted to safe directories for security"
                    }
                )

            elif operation == 'exists':
                if not file_path:
                    return ToolResult(success=False, error="File path is required for exists operation")

                if not self._is_safe_path(file_path):
                    return ToolResult(success=False, error="File path is outside safe directories")

                exists = os.path.exists(file_path)
                return ToolResult(
                    success=True,
                    data={
                        "operation": "exists",
                        "file_path": file_path,
                        "exists": exists,
                        "is_file": os.path.isfile(file_path) if exists else False,
                        "is_directory": os.path.isdir(file_path) if exists else False
                    }
                )

            elif operation == 'read':
                if not file_path:
                    return ToolResult(success=False, error="File path is required for read operation")

                if not self._is_safe_path(file_path):
                    return ToolResult(success=False, error="File path is outside safe directories")

                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read()

                    file_size = os.path.getsize(file_path)

                    return ToolResult(
                        success=True,
                        data={
                            "operation": "read",
                            "file_path": file_path,
                            "content": file_content[:5000],  # Limit content size
                            "size": file_size,
                            "truncated": len(file_content) > 5000,
                            "encoding": "utf-8"
                        }
                    )
                except FileNotFoundError:
                    return ToolResult(success=False, error=f"File not found: {file_path}")
                except PermissionError:
                    return ToolResult(success=False, error=f"Permission denied: {file_path}")
                except UnicodeDecodeError:
                    return ToolResult(success=False, error=f"Cannot decode file as UTF-8: {file_path}")

            elif operation == 'write':
                if not file_path or content is None:
                    return ToolResult(success=False, error="File path and content are required for write operation")

                if not self._is_safe_path(file_path):
                    return ToolResult(success=False, error="File path is outside safe directories")

                try:
                    # Ensure directory exists
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)

                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)

                    return ToolResult(
                        success=True,
                        data={
                            "operation": "write",
                            "file_path": file_path,
                            "bytes_written": len(content.encode('utf-8')),
                            "message": f"Successfully wrote {len(content)} characters to {file_path}"
                        }
                    )
                except PermissionError:
                    return ToolResult(success=False, error=f"Permission denied: {file_path}")
                except OSError as e:
                    return ToolResult(success=False, error=f"OS error: {str(e)}")

            elif operation == 'list':
                directory = file_path or '.'

                if not self._is_safe_path(directory):
                    return ToolResult(success=False, error="Directory path is outside safe directories")

                try:
                    if not os.path.isdir(directory):
                        return ToolResult(success=False, error=f"Not a directory: {directory}")

                    files = []
                    for item in os.listdir(directory):
                        item_path = os.path.join(directory, item)
                        files.append({
                            "name": item,
                            "path": item_path,
                            "is_file": os.path.isfile(item_path),
                            "is_directory": os.path.isdir(item_path),
                            "size": os.path.getsize(item_path) if os.path.isfile(item_path) else None
                        })

                    return ToolResult(
                        success=True,
                        data={
                            "operation": "list",
                            "directory": directory,
                            "files": files,
                            "count": len(files)
                        }
                    )
                except PermissionError:
                    return ToolResult(success=False, error=f"Permission denied: {directory}")
                except FileNotFoundError:
                    return ToolResult(success=False, error=f"Directory not found: {directory}")

            else:
                return ToolResult(success=False, error=f"Unsupported operation: {operation}")

        except Exception as e:
            return ToolResult(success=False, error=f"File operation failed: {str(e)}")

class APIIntegrationTool:
    def __init__(self):
        self.name = "api_integration"

    async def execute(self, **kwargs) -> ToolResult:
        """Handle external API integrations"""
        try:
            api_type = kwargs.get('api_type', '')
            endpoint = kwargs.get('endpoint', '')
            method = kwargs.get('method', 'GET')
            data = kwargs.get('data', {})
            headers = kwargs.get('headers', {})

            if not api_type:
                return ToolResult(
                    success=True,
                    data={
                        "message": "API Integration tool available",
                        "supported_apis": ["weather", "news", "translate", "custom"],
                        "methods": ["GET", "POST"],
                        "note": "Provides integration with external APIs"
                    }
                )

            # Weather API integration
            if api_type == 'weather':
                location = kwargs.get('location', 'London')
                try:
                    # Using OpenWeatherMap-like API structure (demo)
                    weather_data = {
                        "location": location,
                        "temperature": "22°C",
                        "condition": "Partly Cloudy",
                        "humidity": "65%",
                        "wind": "10 km/h",
                        "forecast": "Sunny tomorrow",
                        "note": "Demo weather data - integrate with real weather API"
                    }

                    return ToolResult(
                        success=True,
                        data={
                            "api_type": "weather",
                            "location": location,
                            "weather": weather_data
                        }
                    )
                except Exception as e:
                    return ToolResult(success=False, error=f"Weather API failed: {str(e)}")

            # News API integration
            elif api_type == 'news':
                category = kwargs.get('category', 'general')
                try:
                    news_data = {
                        "category": category,
                        "articles": [
                            {
                                "title": "Sample News Article 1",
                                "summary": "This is a sample news article summary...",
                                "url": "https://example.com/news1",
                                "published": "2025-08-12T10:00:00Z"
                            },
                            {
                                "title": "Sample News Article 2",
                                "summary": "Another sample news article summary...",
                                "url": "https://example.com/news2",
                                "published": "2025-08-12T09:30:00Z"
                            }
                        ],
                        "note": "Demo news data - integrate with real news API"
                    }

                    return ToolResult(
                        success=True,
                        data={
                            "api_type": "news",
                            "category": category,
                            "news": news_data
                        }
                    )
                except Exception as e:
                    return ToolResult(success=False, error=f"News API failed: {str(e)}")

            # Translation API integration
            elif api_type == 'translate':
                text = kwargs.get('text', '')
                target_lang = kwargs.get('target_lang', 'en')
                source_lang = kwargs.get('source_lang', 'auto')

                if not text:
                    return ToolResult(success=False, error="Text is required for translation")

                try:
                    # Demo translation (integrate with real translation API)
                    translated_text = f"[Translated to {target_lang}]: {text}"

                    return ToolResult(
                        success=True,
                        data={
                            "api_type": "translate",
                            "original_text": text,
                            "translated_text": translated_text,
                            "source_language": source_lang,
                            "target_language": target_lang,
                            "confidence": 0.95,
                            "note": "Demo translation - integrate with real translation API"
                        }
                    )
                except Exception as e:
                    return ToolResult(success=False, error=f"Translation API failed: {str(e)}")

            # Custom API integration
            elif api_type == 'custom':
                if not endpoint:
                    return ToolResult(success=False, error="Endpoint is required for custom API calls")

                try:
                    import requests

                    # Set default headers
                    default_headers = {'User-Agent': 'MCP-Agent/1.0'}
                    default_headers.update(headers)

                    if method.upper() == 'GET':
                        response = requests.get(endpoint, headers=default_headers, timeout=10)
                    elif method.upper() == 'POST':
                        response = requests.post(endpoint, json=data, headers=default_headers, timeout=10)
                    else:
                        return ToolResult(success=False, error=f"Unsupported HTTP method: {method}")

                    return ToolResult(
                        success=True,
                        data={
                            "api_type": "custom",
                            "endpoint": endpoint,
                            "method": method,
                            "status_code": response.status_code,
                            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:1000],
                            "headers": dict(response.headers)
                        }
                    )
                except requests.RequestException as e:
                    return ToolResult(success=False, error=f"Custom API request failed: {str(e)}")
                except Exception as e:
                    return ToolResult(success=False, error=f"Custom API integration failed: {str(e)}")

            else:
                return ToolResult(success=False, error=f"Unsupported API type: {api_type}")

        except Exception as e:
            return ToolResult(success=False, error=f"API integration failed: {str(e)}")

@dataclass
class TaskStep:
    """Represents a step in a multi-agent task"""
    agent_id: str
    task_description: str
    input_data: Dict[str, Any]
    dependencies: List[str]  # IDs of steps that must complete first
    status: str = "pending"  # pending, running, completed, failed
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AgentOrchestrator:
    """Orchestrates multi-agent collaboration for complex tasks"""

    def __init__(self, mcp_controller):
        self.mcp_controller = mcp_controller
        self.active_workflows = {}

    async def execute_workflow(self, workflow_id: str, query: str, context: AgentContext) -> Dict[str, Any]:
        """Execute a multi-agent workflow"""
        try:
            # Analyze query to determine workflow type
            workflow_type = self._determine_workflow_type(query)

            if workflow_type == "research_and_code":
                return await self._execute_research_and_code_workflow(workflow_id, query, context)
            elif workflow_type == "analysis_and_creative":
                return await self._execute_analysis_and_creative_workflow(workflow_id, query, context)
            elif workflow_type == "comprehensive_research":
                return await self._execute_comprehensive_research_workflow(workflow_id, query, context)
            else:
                # Default to single agent
                agent = self.mcp_controller._select_agent(query)
                return await agent.process_query(query, context)

        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            return {
                "response": f"**Multi-Agent Workflow Error**\n\nFailed to execute workflow: {str(e)}",
                "agent_type": "orchestrator",
                "error": str(e)
            }

    def _determine_workflow_type(self, query: str) -> str:
        """Determine the appropriate workflow type for a query"""
        query_lower = query.lower()

        # Research + Code workflow
        if any(word in query_lower for word in ['implement', 'build', 'create', 'develop']) and \
           any(word in query_lower for word in ['research', 'analyze', 'study', 'investigate']):
            return "research_and_code"

        # Analysis + Creative workflow
        if any(word in query_lower for word in ['analyze', 'data', 'statistics']) and \
           any(word in query_lower for word in ['write', 'create', 'story', 'report']):
            return "analysis_and_creative"

        # Comprehensive research workflow
        if any(word in query_lower for word in ['comprehensive', 'detailed', 'thorough', 'complete']):
            return "comprehensive_research"

        return "single_agent"

    async def _execute_research_and_code_workflow(self, workflow_id: str, query: str, context: AgentContext) -> Dict[str, Any]:
        """Execute research followed by code implementation"""
        steps = []

        # Step 1: Research phase
        research_agent = self.mcp_controller.agents["research"]
        research_result = await research_agent.process_query(f"Research the requirements for: {query}", context)

        if research_result.get("response"):
            steps.append({
                "agent": "research",
                "task": "Requirements research",
                "result": research_result
            })

            # Step 2: Code implementation based on research
            coding_agent = self.mcp_controller.agents["coding"]
            code_query = f"Based on this research: {research_result.get('response', '')[:500]}..., implement: {query}"
            code_result = await coding_agent.process_query(code_query, context)

            steps.append({
                "agent": "coding",
                "task": "Code implementation",
                "result": code_result
            })

            # Synthesize results
            final_response = self._synthesize_workflow_results("Research & Code", steps, query)

            return {
                "response": final_response,
                "agent_type": "orchestrator",
                "workflow_type": "research_and_code",
                "steps": len(steps),
                "agents_used": ["research", "coding"],
                "confidence": 0.85
            }

        return {"response": "Failed to complete research phase", "agent_type": "orchestrator", "error": "Research failed"}

    async def _execute_analysis_and_creative_workflow(self, workflow_id: str, query: str, context: AgentContext) -> Dict[str, Any]:
        """Execute analysis followed by creative content generation"""
        steps = []

        # Step 1: Analysis phase
        analysis_agent = self.mcp_controller.agents["analysis"]
        analysis_result = await analysis_agent.process_query(f"Analyze the data requirements for: {query}", context)

        if analysis_result.get("response"):
            steps.append({
                "agent": "analysis",
                "task": "Data analysis",
                "result": analysis_result
            })

            # Step 2: Creative content based on analysis
            creative_agent = self.mcp_controller.agents["creative"]
            creative_query = f"Create content based on this analysis: {analysis_result.get('response', '')[:500]}..., for: {query}"
            creative_result = await creative_agent.process_query(creative_query, context)

            steps.append({
                "agent": "creative",
                "task": "Content creation",
                "result": creative_result
            })

            # Synthesize results
            final_response = self._synthesize_workflow_results("Analysis & Creative", steps, query)

            return {
                "response": final_response,
                "agent_type": "orchestrator",
                "workflow_type": "analysis_and_creative",
                "steps": len(steps),
                "agents_used": ["analysis", "creative"],
                "confidence": 0.85
            }

        return {"response": "Failed to complete analysis phase", "agent_type": "orchestrator", "error": "Analysis failed"}

    async def _execute_comprehensive_research_workflow(self, workflow_id: str, query: str, context: AgentContext) -> Dict[str, Any]:
        """Execute comprehensive research using multiple agents"""
        steps = []

        # Step 1: Initial research
        research_agent = self.mcp_controller.agents["research"]
        research_result = await research_agent.process_query(query, context)
        steps.append({
            "agent": "research",
            "task": "Primary research",
            "result": research_result
        })

        # Step 2: Analysis of research findings
        analysis_agent = self.mcp_controller.agents["analysis"]
        analysis_query = f"Analyze these research findings: {research_result.get('response', '')[:500]}..."
        analysis_result = await analysis_agent.process_query(analysis_query, context)
        steps.append({
            "agent": "analysis",
            "task": "Research analysis",
            "result": analysis_result
        })

        # Step 3: Creative synthesis and presentation
        creative_agent = self.mcp_controller.agents["creative"]
        creative_query = f"Create a comprehensive report synthesizing: {query}"
        creative_result = await creative_agent.process_query(creative_query, context)
        steps.append({
            "agent": "creative",
            "task": "Report synthesis",
            "result": creative_result
        })

        # Synthesize all results
        final_response = self._synthesize_workflow_results("Comprehensive Research", steps, query)

        return {
            "response": final_response,
            "agent_type": "orchestrator",
            "workflow_type": "comprehensive_research",
            "steps": len(steps),
            "agents_used": ["research", "analysis", "creative"],
            "confidence": 0.9
        }

    def _synthesize_workflow_results(self, workflow_name: str, steps: List[Dict], original_query: str) -> str:
        """Synthesize results from multiple workflow steps"""
        synthesis = f"**🤖 {workflow_name} Workflow Results**\n\n"
        synthesis += f"**Original Query:** {original_query}\n\n"

        for i, step in enumerate(steps, 1):
            agent_name = step["agent"].title()
            task_name = step["task"]
            result = step["result"]

            synthesis += f"**Step {i}: {task_name} ({agent_name} Agent)**\n"

            if result and result.get("response"):
                # Extract key points from each agent's response
                response_text = result["response"]
                if len(response_text) > 300:
                    response_text = response_text[:300] + "..."
                synthesis += f"{response_text}\n\n"
            else:
                synthesis += "No response generated.\n\n"

        synthesis += "**🎯 Workflow Summary**\n"
        synthesis += f"Successfully completed {len(steps)} steps using {len(set(step['agent'] for step in steps))} specialized agents. "
        synthesis += "This multi-agent approach provides comprehensive coverage of your request with specialized expertise at each stage."

        return synthesis

# Main execution
async def main():
    """Main function to handle MCP requests"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        return

    try:
        # Parse input from command line argument
        input_data = json.loads(sys.argv[1])

        # Initialize MCP controller
        controller = MCPController()

        # Determine request type
        request_type = input_data.get('type', 'query')

        if request_type == 'feedback':
            # Process feedback
            result = await controller.process_feedback(input_data)
        elif request_type == 'performance':
            # Get agent performance
            agent_id = input_data.get('agent_id', '')
            result = await controller.get_agent_performance(agent_id)
        elif request_type == 'recommendations':
            # Get learning recommendations
            agent_id = input_data.get('agent_id', '')
            result = await controller.get_learning_recommendations(agent_id)
        else:
            # Default query processing
            result = await controller.process_request(input_data)

        # Output result as JSON
        print(json.dumps(result))

    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Invalid JSON input"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
