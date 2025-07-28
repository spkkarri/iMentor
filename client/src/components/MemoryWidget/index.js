// client/src/components/MemoryWidget/index.js
import React, { useState, useEffect, useCallback } from 'react';
import { getMemories, addMemory, deleteMemory } from '../../services/api';
import { FaTrash, FaSpinner } from 'react-icons/fa';
import './index.css';

const MemoryWidget = () => {
    const [memories, setMemories] = useState([]);
    const [newMemory, setNewMemory] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const fetchMemories = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await getMemories();
            // All memories are now considered 'confirmed' from the user's perspective
            setMemories(response.data);
        } catch (err) {
            setError('Failed to load memories.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMemories();
    }, [fetchMemories]);

    const handleAddMemory = async (e) => {
        e.preventDefault();
        if (!newMemory.trim()) return;

        setIsSubmitting(true);
        setError('');
        try {
            const response = await addMemory({ content: newMemory });
            setMemories([response.data, ...memories]);
            setNewMemory('');
        } catch (err) {
            setError('Failed to add memory.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMemory = async (memoryId) => {
        try {
            await deleteMemory(memoryId);
            setMemories(memories.filter(mem => mem._id !== memoryId));
        } catch (err) {
            setError('Failed to delete memory.');
        }
    };

    return (
        <div className="memory-widget">
            <h4>Your Memory</h4>
            <form className="memory-input-area" onSubmit={handleAddMemory}>
                <textarea
                    className="memory-textarea"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add a fact for the AI to remember..."
                    disabled={isSubmitting}
                />
                <button type="submit" className="add-memory-btn" disabled={isSubmitting || !newMemory.trim()}>
                    {isSubmitting ? 'Adding...' : 'Add to Memory'}
                </button>
            </form>

            {error && <p className="memory-status error">{error}</p>}

            {isLoading ? (
                <div className="memory-status"><FaSpinner className="spin" /> Loading memories...</div>
            ) : (
                <ul className="memory-list">
                    {memories.length > 0 ? (
                        memories.map(mem => (
                            <li key={mem._id} className="memory-item">
                                <span className="memory-content">{mem.content}</span>
                                <button
                                    className="delete-memory-btn"
                                    title="Forget this"
                                    onClick={() => handleDeleteMemory(mem._id)}
                                >
                                    <FaTrash />
                                </button>
                            </li>
                        ))
                    ) : (
                        <div className="memory-status">No memories stored yet.</div>
                    )}
                </ul>
            )}
        </div>
    );
};

export default MemoryWidget;