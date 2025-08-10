import { useState, useEffect } from 'react';

const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [connectionType, setConnectionType] = useState('unknown');

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            console.log('🌐 Network: Back online');
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('🚫 Network: Gone offline');
        };

        const updateConnectionType = () => {
            if ('connection' in navigator) {
                setConnectionType(navigator.connection.effectiveType || 'unknown');
            }
        };

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check connection type if available
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', updateConnectionType);
            updateConnectionType();
        }

        // Cleanup
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if ('connection' in navigator) {
                navigator.connection.removeEventListener('change', updateConnectionType);
            }
        };
    }, []);

    return { isOnline, connectionType };
};

export default useNetworkStatus;
