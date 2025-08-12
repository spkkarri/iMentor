// client/src/components/ApiKeySetupPage.js
// API Key setup page for new users

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Button, 
    Card, 
    CardContent, 
    TextField, 
    Typography, 
    Stepper,
    Step,
    StepLabel,
    FormControlLabel,
    Checkbox,
    Alert,
    CircularProgress,
    Divider,
    Chip,
    Link
} from '@mui/material';
import { updateUserApiKeys, testUserServices, requestAdminAccess, clearUserServiceCache } from '../services/api';

const ApiKeySetupPage = ({ setIsAuthenticated }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState('llama2');
    const [useAdminKeys, setUseAdminKeys] = useState(false);
    const [adminAccessReason, setAdminAccessReason] = useState('');
    const [preferredService, setPreferredService] = useState('gemini');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [testResults, setTestResults] = useState(null);
    const navigate = useNavigate();

    const steps = ['Choose Setup Method', 'Configure Services', 'Test & Complete'];

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleSkipToAdminRequest = () => {
        setUseAdminKeys(true);
        setActiveStep(2); // Skip to final step
    };

    const handleTestServices = async () => {
        setIsLoading(true);
        setError('');
        
        try {
            // First save the configuration
            await updateUserApiKeys({
                geminiApiKey: geminiApiKey || undefined,
                ollamaUrl: ollamaUrl || undefined,
                ollamaModel: ollamaModel || undefined,
                preferredService: preferredService,
                useAdminKeys: useAdminKeys
            });

            // 🔥 Clear service cache to ensure new API key is used
            console.log('🗑️ Clearing service cache after API key update...');
            try {
                await clearUserServiceCache();
                console.log('✅ Service cache cleared successfully');
            } catch (cacheError) {
                console.warn('⚠️ Failed to clear cache, but continuing:', cacheError);
            }

            // Then test the services
            const response = await testUserServices();
            setTestResults(response.data);
            setSuccess('Configuration saved, cache cleared, and tested successfully!');
        } catch (err) {
            console.error('Error testing services:', err);
            setError(err.response?.data?.message || 'Failed to test services');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestAdminAccess = async () => {
        setIsLoading(true);
        setError('');
        
        try {
            await requestAdminAccess({ reason: adminAccessReason });
            setSuccess('Admin access request submitted successfully! You will be notified once approved.');
            
            // Wait a moment then redirect to chat
            setTimeout(() => {
                navigate('/chat');
            }, 2000);
        } catch (err) {
            console.error('Error requesting admin access:', err);
            setError(err.response?.data?.message || 'Failed to submit admin access request');
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        if (useAdminKeys) {
            await handleRequestAdminAccess();
        } else {
            // Save final configuration and redirect
            try {
                await updateUserApiKeys({
                    preferredService: preferredService,
                    useAdminKeys: false
                });
                navigate('/chat');
            } catch (err) {
                setError('Failed to save configuration');
            }
        }
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            How would you like to use the AI services?
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                            Choose your preferred setup method
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Card 
                                sx={{ 
                                    p: 2, 
                                    cursor: 'pointer', 
                                    border: !useAdminKeys ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                    '&:hover': { boxShadow: 3 }
                                }}
                                onClick={() => setUseAdminKeys(false)}
                            >
                                <Typography variant="h6" color="primary">
                                    🔑 Use My Own API Keys
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Provide your own Gemini API key and/or Ollama setup for unlimited usage
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Chip label="Unlimited Usage" color="success" size="small" sx={{ mr: 1 }} />
                                    <Chip label="Your Own Keys" color="primary" size="small" />
                                </Box>
                            </Card>

                            <Card 
                                sx={{ 
                                    p: 2, 
                                    cursor: 'pointer', 
                                    border: useAdminKeys ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                    '&:hover': { boxShadow: 3 }
                                }}
                                onClick={() => setUseAdminKeys(true)}
                            >
                                <Typography variant="h6" color="primary">
                                    🏢 Request Admin API Access
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Use shared admin API keys (requires approval)
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Chip label="Requires Approval" color="warning" size="small" sx={{ mr: 1 }} />
                                    <Chip label="Shared Resources" color="info" size="small" />
                                </Box>
                            </Card>
                        </Box>

                        <Box sx={{ mt: 4 }}>
                            <Button 
                                variant="contained" 
                                onClick={useAdminKeys ? handleSkipToAdminRequest : handleNext}
                                disabled={!useAdminKeys && activeStep === 0}
                            >
                                {useAdminKeys ? 'Request Admin Access' : 'Configure My Keys'}
                            </Button>
                        </Box>
                    </Box>
                );

            case 1:
                return (
                    <Box sx={{ py: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Configure Your AI Services
                        </Typography>
                        
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                🤖 Gemini AI Configuration
                            </Typography>
                            <TextField
                                fullWidth
                                label="Gemini API Key"
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="AIza..."
                                helperText={
                                    <span>
                                        Get your free API key from{' '}
                                        <Link href="https://makersuite.google.com/app/apikey" target="_blank">
                                            Google AI Studio
                                        </Link>
                                    </span>
                                }
                                sx={{ mb: 2 }}
                            />
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                🦙 Ollama Configuration (Optional)
                            </Typography>
                            <TextField
                                fullWidth
                                label="Ollama URL"
                                value={ollamaUrl}
                                onChange={(e) => setOllamaUrl(e.target.value)}
                                placeholder="http://localhost:11434"
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                label="Ollama Model"
                                value={ollamaModel}
                                onChange={(e) => setOllamaModel(e.target.value)}
                                placeholder="llama2"
                                helperText="Model name to use with Ollama"
                            />
                        </Box>

                        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                            <Button onClick={handleBack}>
                                Back
                            </Button>
                            <Button 
                                variant="contained" 
                                onClick={handleNext}
                                disabled={!geminiApiKey && !ollamaUrl}
                            >
                                Test Configuration
                            </Button>
                        </Box>
                    </Box>
                );

            case 2:
                return (
                    <Box sx={{ py: 2 }}>
                        {useAdminKeys ? (
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Request Admin API Access
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Please provide a reason for requesting access to admin API keys
                                </Typography>
                                
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    label="Reason for Request"
                                    value={adminAccessReason}
                                    onChange={(e) => setAdminAccessReason(e.target.value)}
                                    placeholder="e.g., I'm a student/researcher and need access for educational purposes..."
                                    sx={{ mb: 3 }}
                                />

                                <Alert severity="info" sx={{ mb: 3 }}>
                                    Your request will be reviewed by an administrator. You'll be notified once approved.
                                </Alert>
                            </Box>
                        ) : (
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Test Your Configuration
                                </Typography>
                                
                                {!testResults && (
                                    <Button 
                                        variant="outlined" 
                                        onClick={handleTestServices}
                                        disabled={isLoading}
                                        sx={{ mb: 2 }}
                                    >
                                        {isLoading ? <CircularProgress size={20} /> : 'Test Services'}
                                    </Button>
                                )}

                                {testResults && (
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Test Results:
                                        </Typography>
                                        
                                        {testResults.gemini.configured && (
                                            <Alert 
                                                severity={testResults.gemini.valid ? 'success' : 'error'} 
                                                sx={{ mb: 1 }}
                                            >
                                                Gemini: {testResults.gemini.message}
                                            </Alert>
                                        )}
                                        
                                        {testResults.ollama.configured && (
                                            <Alert 
                                                severity={testResults.ollama.valid ? 'success' : 'error'} 
                                                sx={{ mb: 1 }}
                                            >
                                                Ollama: {testResults.ollama.message}
                                            </Alert>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                            {!useAdminKeys && (
                                <Button onClick={handleBack}>
                                    Back
                                </Button>
                            )}
                            <Button 
                                variant="contained" 
                                onClick={handleComplete}
                                disabled={isLoading || (!useAdminKeys && !testResults)}
                            >
                                {isLoading ? <CircularProgress size={20} /> : 
                                 useAdminKeys ? 'Submit Request' : 'Complete Setup'}
                            </Button>
                        </Box>
                    </Box>
                );

            default:
                return 'Unknown step';
        }
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
            <Card sx={{ minWidth: 500, maxWidth: 700, width: '100%', boxShadow: 5, borderRadius: 2 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
                        Setup Your AI Services
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" mb={4}>
                        Configure your API keys and preferences to get started
                    </Typography>

                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {renderStepContent(activeStep)}

                    <Divider sx={{ my: 3 }} />
                    
                    <Box sx={{ textAlign: 'center' }}>
                        <Button 
                            variant="text" 
                            onClick={() => navigate('/chat')}
                            size="small"
                        >
                            Skip Setup (Configure Later)
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ApiKeySetupPage;
