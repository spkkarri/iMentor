// client/src/components/DSAWidget/index.js
import React, { useState } from 'react';
import { FaCode, FaChartLine, FaLightbulb, FaPlay } from 'react-icons/fa';
import './index.css';

const DSAWidget = ({ onDSAQuery }) => {
    const [selectedDifficulty, setSelectedDifficulty] = useState('beginner');
    const [customQuery, setCustomQuery] = useState('');

    const dsaTopics = [
        { id: 'arrays', name: 'Arrays & Strings', icon: '📊' },
        { id: 'linkedlists', name: 'Linked Lists', icon: '🔗' },
        { id: 'stacks', name: 'Stacks & Queues', icon: '📚' },
        { id: 'trees', name: 'Trees & Graphs', icon: '🌳' },
        { id: 'sorting', name: 'Sorting Algorithms', icon: '🔄' },
        { id: 'searching', name: 'Searching Algorithms', icon: '🔍' },
        { id: 'dp', name: 'Dynamic Programming', icon: '💡' },
        { id: 'greedy', name: 'Greedy Algorithms', icon: '🎯' },
        { id: 'backtracking', name: 'Backtracking', icon: '↩️' },
        { id: 'graphs', name: 'Graph Algorithms', icon: '🕸️' }
    ];

    const difficulties = [
        { id: 'beginner', name: 'Beginner', color: '#4CAF50' },
        { id: 'intermediate', name: 'Intermediate', color: '#FF9800' },
        { id: 'advanced', name: 'Advanced', color: '#F44336' }
    ];

    const quickQueries = [
        'Explain binary search algorithm with example',
        'What is the time complexity of merge sort?',
        'How to implement a stack using arrays?',
        'Difference between BFS and DFS',
        'Dynamic programming vs greedy approach',
        'How to detect cycle in linked list?'
    ];

    const handleTopicSelect = (topicId) => {
        const topic = dsaTopics.find(t => t.id === topicId);
        if (topic && onDSAQuery) {
            const query = `Explain ${topic.name} for ${selectedDifficulty} level with examples and code implementation`;
            onDSAQuery(query, 'dsa', { topic: topicId, difficulty: selectedDifficulty });
        }
    };

    const handleQuickQuery = (query) => {
        if (onDSAQuery) {
            onDSAQuery(query, 'dsa', { type: 'quick_query' });
        }
    };

    const handleCustomQuery = () => {
        if (customQuery.trim() && onDSAQuery) {
            const enhancedQuery = `${customQuery} (Please provide detailed explanation with code examples and complexity analysis)`;
            onDSAQuery(enhancedQuery, 'dsa', { type: 'custom', difficulty: selectedDifficulty });
            setCustomQuery('');
        }
    };

    return (
        <div className="dsa-widget">
            <h3 className="dsa-widget-title">
                <FaCode className="dsa-icon" />
                Data Structures & Algorithms
            </h3>

            {/* Difficulty Selector */}
            <div className="difficulty-selector">
                <label className="difficulty-label">Difficulty Level:</label>
                <div className="difficulty-options">
                    {difficulties.map(diff => (
                        <button
                            key={diff.id}
                            className={`difficulty-btn ${selectedDifficulty === diff.id ? 'active' : ''}`}
                            style={{ '--difficulty-color': diff.color }}
                            onClick={() => setSelectedDifficulty(diff.id)}
                        >
                            {diff.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Topic Grid */}
            <div className="dsa-topics">
                <h4 className="section-title">Choose a Topic:</h4>
                <div className="topics-grid">
                    {dsaTopics.map(topic => (
                        <button
                            key={topic.id}
                            className="topic-card"
                            onClick={() => handleTopicSelect(topic.id)}
                        >
                            <span className="topic-icon">{topic.icon}</span>
                            <span className="topic-name">{topic.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Queries */}
            <div className="quick-queries">
                <h4 className="section-title">
                    <FaLightbulb className="section-icon" />
                    Quick Questions:
                </h4>
                <div className="queries-list">
                    {quickQueries.map((query, index) => (
                        <button
                            key={index}
                            className="query-btn"
                            onClick={() => handleQuickQuery(query)}
                        >
                            <FaPlay className="query-icon" />
                            {query}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Query */}
            <div className="custom-query">
                <h4 className="section-title">Ask Your Own Question:</h4>
                <div className="query-input-group">
                    <textarea
                        className="query-input"
                        placeholder="e.g., How to implement quicksort algorithm?"
                        value={customQuery}
                        onChange={(e) => setCustomQuery(e.target.value)}
                        rows={3}
                    />
                    <button
                        className="query-submit-btn"
                        onClick={handleCustomQuery}
                        disabled={!customQuery.trim()}
                    >
                        <FaPlay />
                        Ask Question
                    </button>
                </div>
            </div>

            {/* Algorithm Complexity Reference */}
            <div className="complexity-reference">
                <h4 className="section-title">
                    <FaChartLine className="section-icon" />
                    Time Complexity Reference:
                </h4>
                <div className="complexity-table">
                    <div className="complexity-row">
                        <span className="complexity-notation">O(1)</span>
                        <span className="complexity-name">Constant</span>
                    </div>
                    <div className="complexity-row">
                        <span className="complexity-notation">O(log n)</span>
                        <span className="complexity-name">Logarithmic</span>
                    </div>
                    <div className="complexity-row">
                        <span className="complexity-notation">O(n)</span>
                        <span className="complexity-name">Linear</span>
                    </div>
                    <div className="complexity-row">
                        <span className="complexity-notation">O(n log n)</span>
                        <span className="complexity-name">Linearithmic</span>
                    </div>
                    <div className="complexity-row">
                        <span className="complexity-notation">O(n²)</span>
                        <span className="complexity-name">Quadratic</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DSAWidget;
