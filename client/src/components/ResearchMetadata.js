// client/src/components/ResearchMetadata.js
// Component to display advanced research metadata and verification results

import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    LinearProgress,
    Grid,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Tooltip,
    IconButton
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Science as ScienceIcon,
    Search as SearchIcon,
    Verified as VerifiedIcon,
    Psychology as PsychologyIcon,
    Assignment as AssignmentIcon,
    Timeline as TimelineIcon
} from '@mui/icons-material';

const ResearchMetadata = ({ metadata }) => {
    const [expanded, setExpanded] = useState(false);

    if (!metadata || metadata.searchType !== 'advanced_deep_research') {
        return null;
    }

    const getConfidenceColor = (confidence) => {
        switch (confidence) {
            case 'high': return 'success';
            case 'medium': return 'warning';
            case 'low': return 'error';
            default: return 'default';
        }
    };

    const getConfidenceIcon = (confidence) => {
        switch (confidence) {
            case 'high': return <CheckCircleIcon />;
            case 'medium': return <WarningIcon />;
            case 'low': return <ErrorIcon />;
            default: return <InfoIcon />;
        }
    };

    const formatTime = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const researchStages = [
        { name: 'Query Analysis', icon: <PsychologyIcon />, description: 'Understanding and breaking down the query' },
        { name: 'Research Planning', icon: <AssignmentIcon />, description: 'Creating a strategic research plan' },
        { name: 'Information Retrieval', icon: <SearchIcon />, description: 'Gathering data from multiple sources' },
        { name: 'Cross-Verification', icon: <VerifiedIcon />, description: 'Verifying facts across sources' },
        { name: 'Answer Synthesis', icon: <ScienceIcon />, description: 'Combining verified information' },
        { name: 'Output Formatting', icon: <TimelineIcon />, description: 'Structuring the final response' }
    ];

    return (
        <Card sx={{ mt: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ScienceIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" color="primary">
                        Advanced Deep Research Results
                    </Typography>
                    <Chip 
                        label={`${metadata.confidenceLevel} confidence`}
                        color={getConfidenceColor(metadata.confidenceLevel)}
                        size="small"
                        sx={{ ml: 2 }}
                        icon={getConfidenceIcon(metadata.confidenceLevel)}
                    />
                </Box>

                {/* Research Summary */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                                {metadata.researchStages}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Research Stages
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                                {metadata.sourcesFound}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Sources Found
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                                {metadata.verifiedFacts}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Verified Facts
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                                {formatTime(metadata.researchTime)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Research Time
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                {/* Research Stages Progress */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Research Process Completed
                    </Typography>
                    <LinearProgress 
                        variant="determinate" 
                        value={100} 
                        sx={{ height: 8, borderRadius: 4 }}
                        color="success"
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        {researchStages.map((stage, index) => (
                            <Tooltip key={index} title={stage.description}>
                                <Box sx={{ textAlign: 'center', flex: 1 }}>
                                    {React.cloneElement(stage.icon, { 
                                        sx: { fontSize: 16, color: 'success.main' } 
                                    })}
                                    <Typography variant="caption" display="block" sx={{ fontSize: '0.6rem' }}>
                                        {stage.name}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        ))}
                    </Box>
                </Box>

                {/* Detailed Results */}
                <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">
                            Detailed Research Analysis
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {/* Query Breakdown */}
                        {metadata.breakdown && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Query Analysis
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Main Topic:</strong> {metadata.breakdown.mainTopic}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Intent:</strong> {metadata.breakdown.intent}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Complexity:</strong> {metadata.breakdown.complexityLevel}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Research Domains:</strong> {metadata.breakdown.researchDomains?.join(', ')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Sub-questions:</strong> {metadata.breakdown.subQuestions?.length || 0}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        {/* Verification Results */}
                        {metadata.verificationResults && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Fact Verification Results
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={4}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" color="success.main">
                                                {metadata.verificationResults.highConfidence || 0}
                                            </Typography>
                                            <Typography variant="caption">High Confidence</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" color="warning.main">
                                                {metadata.verificationResults.mediumConfidence || 0}
                                            </Typography>
                                            <Typography variant="caption">Medium Confidence</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" color="error.main">
                                                {metadata.verificationResults.lowConfidence || 0}
                                            </Typography>
                                            <Typography variant="caption">Low Confidence</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        {/* Sources */}
                        {metadata.sources && metadata.sources.length > 0 && (
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Verified Sources ({metadata.sources.length})
                                </Typography>
                                <List dense>
                                    {metadata.sources.slice(0, 5).map((source, index) => (
                                        <ListItem key={index}>
                                            <ListItemIcon>
                                                {getConfidenceIcon(source.confidence)}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={source.fact}
                                                secondary={
                                                    <Box>
                                                        <Chip 
                                                            label={source.confidence} 
                                                            size="small" 
                                                            color={getConfidenceColor(source.confidence)}
                                                            sx={{ mr: 1 }}
                                                        />
                                                        <Chip 
                                                            label={source.reliability} 
                                                            size="small" 
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                    {metadata.sources.length > 5 && (
                                        <ListItem>
                                            <ListItemText
                                                primary={`... and ${metadata.sources.length - 5} more sources`}
                                                sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            </CardContent>
        </Card>
    );
};

export default ResearchMetadata;
