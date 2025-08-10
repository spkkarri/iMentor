import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to console for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div style={{
                    padding: '20px',
                    margin: '20px',
                    border: '1px solid #ff6b6b',
                    borderRadius: '8px',
                    backgroundColor: '#ffe0e0',
                    color: '#d63031',
                    fontFamily: 'Arial, sans-serif'
                }}>
                    <h2>🚨 Something went wrong!</h2>
                    <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
                    
                    <details style={{ marginTop: '10px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                            Click for technical details
                        </summary>
                        <div style={{ 
                            marginTop: '10px', 
                            padding: '10px', 
                            backgroundColor: '#f8f8f8', 
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                            <br />
                            <strong>Stack Trace:</strong> {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </div>
                    </details>
                    
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: '#0984e3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
