// Hook to get and manage the selected AI model across the application
import { useState, useEffect } from 'react';

export const useSelectedModel = () => {
    const [selectedModel, setSelectedModel] = useState('gemini-flash');

    useEffect(() => {
        // Load selected model from localStorage on mount
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            setSelectedModel(savedModel);
        }
    }, []);

    const updateSelectedModel = (model) => {
        setSelectedModel(model);
        localStorage.setItem('selectedModel', model);
    };

    return {
        selectedModel,
        setSelectedModel: updateSelectedModel
    };
};

export default useSelectedModel;
