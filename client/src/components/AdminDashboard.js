// client/src/components/AdminDashboard.js
// Admin dashboard for managing users and API key access requests

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    AppBar,
    Toolbar,
    IconButton
} from '@mui/material';
import { 
    ExitToApp as LogoutIcon,
    CheckCircle as ApproveIcon,
    Cancel as DenyIcon,
    Block as RevokeIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import {
    getAdminDashboard,
    getAllUsers,
    approveAdminAccess,
    denyAdminAccess,
    revokeAdminAccess,
    getUserDetails
} from '../services/api';

const AdminDashboard = ({ setIsAuthenticated }) => {
    const [tabValue, setTabValue] = useState(0);
    const [dashboardData, setDashboardData] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [actionType, setActionType] = useState('');
    const [actionReason, setActionReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboardData();
        loadUsers();
    }, []);

    const loadDashboardData = async () => {
        try {
            const response = await getAdminDashboard();
            setDashboardData(response.data);
        } catch (err) {
            console.error('Error loading dashboard:', err);
            if (err.response?.status === 403) {
                setError('Access denied. Admin privileges required.');
                setTimeout(() => navigate('/chat'), 2000);
            } else {
                setError('Failed to load dashboard data');
            }
        }
    };

    const loadUsers = async () => {
        try {
            const response = await getAllUsers();
            setUsers(response.data);
        } catch (err) {
            console.error('Error loading users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        loadDashboardData();
        loadUsers();
    };

    const handleLogout = () => {
        localStorage.clear();
        setIsAuthenticated(false);
        navigate('/');
    };

    const handleUserAction = async (user, action) => {
        setSelectedUser(user);
        setActionType(action);
        setActionReason('');
        setDialogOpen(true);
    };

    const executeUserAction = async () => {
        if (!selectedUser || !actionType) return;

        try {
            const data = { reason: actionReason };
            
            switch (actionType) {
                case 'approve':
                    await approveAdminAccess(selectedUser.id, { note: actionReason });
                    setSuccess(`Approved admin access for ${selectedUser.email}`);
                    break;
                case 'deny':
                    await denyAdminAccess(selectedUser.id, data);
                    setSuccess(`Denied admin access for ${selectedUser.email}`);
                    break;
                case 'revoke':
                    await revokeAdminAccess(selectedUser.id, data);
                    setSuccess(`Revoked admin access for ${selectedUser.email}`);
                    break;
                default:
                    break;
            }
            
            setDialogOpen(false);
            loadDashboardData();
            loadUsers();
        } catch (err) {
            console.error('Error executing user action:', err);
            setError(err.response?.data?.message || 'Action failed');
        }
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            pending: { color: 'warning', label: 'Pending' },
            approved: { color: 'success', label: 'Approved' },
            denied: { color: 'error', label: 'Denied' },
            revoked: { color: 'default', label: 'Revoked' }
        };
        
        const config = statusConfig[status] || { color: 'default', label: status };
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Admin Dashboard
                    </Typography>
                    <IconButton color="inherit" onClick={handleRefresh}>
                        <RefreshIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{ p: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                {/* Dashboard Stats */}
                {dashboardData && (
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Total Users
                                    </Typography>
                                    <Typography variant="h4">
                                        {dashboardData.stats.totalUsers}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Pending Requests
                                    </Typography>
                                    <Typography variant="h4" color="warning.main">
                                        {dashboardData.stats.pendingAdminRequests}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Approved Users
                                    </Typography>
                                    <Typography variant="h4" color="success.main">
                                        {dashboardData.stats.approvedAdminUsers}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Total Requests
                                    </Typography>
                                    <Typography variant="h4">
                                        {dashboardData.stats.totalRequests}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                        <Tab label="Pending Requests" />
                        <Tab label="All Users" />
                        <Tab label="Approved Users" />
                    </Tabs>
                </Box>

                {/* Pending Requests Tab */}
                {tabValue === 0 && dashboardData && (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Requested At</TableCell>
                                    <TableCell>Reason</TableCell>
                                    <TableCell>Has Own Keys</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dashboardData.pendingRequests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>{request.email}</TableCell>
                                        <TableCell>{formatDate(request.requestedAt)}</TableCell>
                                        <TableCell>{request.reason}</TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={request.hasOwnKeys ? 'Yes' : 'No'} 
                                                color={request.hasOwnKeys ? 'success' : 'default'} 
                                                size="small" 
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                startIcon={<ApproveIcon />}
                                                color="success"
                                                size="small"
                                                onClick={() => handleUserAction(request, 'approve')}
                                                sx={{ mr: 1 }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                startIcon={<DenyIcon />}
                                                color="error"
                                                size="small"
                                                onClick={() => handleUserAction(request, 'deny')}
                                            >
                                                Deny
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {dashboardData.pendingRequests.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No pending requests
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* All Users Tab */}
                {tabValue === 1 && (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Service</TableCell>
                                    <TableCell>Admin Status</TableCell>
                                    <TableCell>API Keys</TableCell>
                                    <TableCell>Last Used</TableCell>
                                    <TableCell>Requests</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip label={user.preferredService} size="small" />
                                        </TableCell>
                                        <TableCell>
                                            {getStatusChip(user.adminAccessStatus)}
                                        </TableCell>
                                        <TableCell>
                                            {user.hasValidGemini && <Chip label="Gemini" color="primary" size="small" sx={{ mr: 0.5 }} />}
                                            {user.hasValidOllama && <Chip label="Ollama" color="secondary" size="small" />}
                                        </TableCell>
                                        <TableCell>{formatDate(user.lastUsed)}</TableCell>
                                        <TableCell>{user.totalRequests}</TableCell>
                                        <TableCell>
                                            {user.adminAccessStatus === 'approved' && (
                                                <Button
                                                    startIcon={<RevokeIcon />}
                                                    color="warning"
                                                    size="small"
                                                    onClick={() => handleUserAction(user, 'revoke')}
                                                >
                                                    Revoke
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Approved Users Tab */}
                {tabValue === 2 && dashboardData && (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Approved At</TableCell>
                                    <TableCell>Approved By</TableCell>
                                    <TableCell>Total Requests</TableCell>
                                    <TableCell>Last Used</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dashboardData.approvedUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{formatDate(user.approvedAt)}</TableCell>
                                        <TableCell>{user.approvedBy}</TableCell>
                                        <TableCell>{user.totalRequests}</TableCell>
                                        <TableCell>{formatDate(user.lastUsed)}</TableCell>
                                        <TableCell>
                                            <Button
                                                startIcon={<RevokeIcon />}
                                                color="warning"
                                                size="small"
                                                onClick={() => handleUserAction(user, 'revoke')}
                                            >
                                                Revoke
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {dashboardData.approvedUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            No approved users
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Action Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionType === 'approve' && 'Approve Admin Access'}
                    {actionType === 'deny' && 'Deny Admin Access'}
                    {actionType === 'revoke' && 'Revoke Admin Access'}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        User: {selectedUser?.email}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label={actionType === 'approve' ? 'Note (optional)' : 'Reason'}
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={
                            actionType === 'approve' ? 'Optional note for approval...' :
                            actionType === 'deny' ? 'Reason for denial...' :
                            'Reason for revocation...'
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={executeUserAction} 
                        variant="contained"
                        color={actionType === 'approve' ? 'success' : 'error'}
                    >
                        {actionType === 'approve' && 'Approve'}
                        {actionType === 'deny' && 'Deny'}
                        {actionType === 'revoke' && 'Revoke'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminDashboard;
