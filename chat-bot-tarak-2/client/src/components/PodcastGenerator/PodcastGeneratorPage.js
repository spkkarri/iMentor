// client/src/components/PodcastGenerator/PodcastGeneratorPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './PodcastGeneratorPage.css';
import InputModal from './InputModal';
import MediaPlayer from './MediaPlayer';
import QnAWidget from './QnAWidget';
import { AddCircleOutline } from '@mui/icons-material';
import PodcastHistory from './PodcastHistory';

const PodcastGeneratorPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false); // Start with modal closed
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // State for the CURRENTLY LOADED podcast
    const [podcastData, setPodcastData] = useState(null);
    
    // State for history
    const [podcastHistory, setPodcastHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    const [isPaused, setIsPaused] = useState(false);
    const [isAsking, setIsAsking] = useState(false);
    const [qaAnswer, setQaAnswer] = useState('');

    // Function to fetch podcast history
    const fetchHistory = useCallback(async () => {
        setIsHistoryLoading(true);
        try {
            const userId = localStorage.getItem('userId');
            const response = await axios.get('/api/podcasts', {
                headers: { 'x-user-id': userId }
            });
            setPodcastHistory(response.data);
        } catch (err) {
            setError('Could not load podcast history.');
            console.error(err);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    // Fetch history when the component first loads
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleGenerate = async ({ inputType, inputData, title }) => {
        setIsLoading(true);
        setError(null);
        setIsModalOpen(false);
        setPodcastData(null);

        const userId = localStorage.getItem('userId');
        if (!userId) {
            setError("User not authenticated. Please log in again.");
            setIsLoading(false);
            return;
        }

        try {
            let response;
            if (inputType === 'file') {
                const formData = new FormData();
                formData.append('file', inputData);
                formData.append('title', title);

                response = await axios.post('/api/podcast/generate/file', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'x-user-id': userId,
                    },
                });
            } else { // For 'raw_text' and 'youtube_url'
                response = await axios.post('/api/podcast/generate/json', {
                    inputType,
                    inputData,
                    title,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': userId,
                    },
                });
            }
            
            // On success, set the new podcast as the current one AND refresh the history list
            setPodcastData({ ...response.data, title });
            fetchHistory(); // <-- REFRESH HISTORY

        } catch (err) {
            setError(err.response?.data?.msg || err.response?.data?.error || 'An unexpected error occurred.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAskQuestion = async (question) => {
        if (!podcastData?.podcastId) return;
        setIsAsking(true);
        setQaAnswer('');
        setError(null);

        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                throw new Error("User not authenticated. Please log in again.");
            }

            const res = await axios.post('/api/podcast/ask', {
                podcastId: podcastData.podcastId,
                question: question,
            }, {
                headers: {
                    'x-user-id': userId
                }
            });
            setQaAnswer(res.data.answer);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to get an answer.');
            console.error(err);
        } finally {
            setIsAsking(false);
        }
    };

    // Handlers for history actions
    const handleLoadPodcast = (podcastToLoad) => {
        console.log("Loading podcast:", podcastToLoad);
        // The object from history already has the necessary fields
        setPodcastData(podcastToLoad);
        // Scroll to the top to see the player
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeletePodcast = async (podcastDbId) => {
        // Optimistically remove from UI
        setPodcastHistory(prev => prev.filter(p => p._id !== podcastDbId));
        
        try {
            const userId = localStorage.getItem('userId');
            await axios.delete(`/api/podcasts/${podcastDbId}`, {
                headers: { 'x-user-id': userId }
            });
            // If the deleted podcast was the currently loaded one, clear the player
            if (podcastData && podcastData._id === podcastDbId) {
                setPodcastData(null);
            }
        } catch (err) {
            setError('Failed to delete podcast. Please refresh.');
            console.error(err);
            fetchHistory(); // Re-fetch to correct the UI on error
        }
    };

    return (
        <div className="podcast-generator-page">
            <header className="p-header">
                <h1>Interactive AI Podcast Generator</h1>
                <button className="add-source-btn" onClick={() => setIsModalOpen(true)}>
                    <AddCircleOutline /> New Podcast
                </button>
            </header>

            <main className="p-main">
                <InputModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onGenerate={handleGenerate}
                />

                {isLoading && (
                    <div className="p-loading-spinner">
                        <div className="spinner"></div>
                        <p>Generating your podcast... this may take a few moments.</p>
                    </div>
                )}
                {error && <div className="p-error-message">{error}</div>}

                {/* The currently active podcast player */}
                {podcastData && (
                    <div className="p-results-section">
                        <MediaPlayer 
                            audioUrl={`/${podcastData.audioUrl}`}
                            title={podcastData.title}
                            onPause={() => setIsPaused(true)}
                            onPlay={() => setIsPaused(false)}
                        />
                        {isPaused && (
                            <QnAWidget
                                onAsk={handleAskQuestion}
                                isAsking={isAsking}
                                answer={qaAnswer}
                            />
                        )}
                    </div>
                )}
                
                {/* The new history section */}
                <div className="history-section">
                    {isHistoryLoading ? (
                        <p style={{textAlign: 'center', color: '#ccc'}}>Loading history...</p>
                    ) : (
                        <PodcastHistory 
                            history={podcastHistory}
                            onLoad={handleLoadPodcast}
                            onDelete={handleDeletePodcast}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default PodcastGeneratorPage;