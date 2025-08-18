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
    Refresh as RefreshIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import {
    getAdminDashboard,
    getAllUsers,
    getActivityLogs,
    getActivitySummary,
    deleteUser as deleteUserApi
} from '../services/api';

const AdminDashboard = ({ setIsAuthenticated }) => {
    const [tabValue, setTabValue] = useState(0);
    const [dashboardData, setDashboardData] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activity, setActivity] = useState({ items: [], total: 0, page: 1, pageSize: 50 });
    const [activityLoading, setActivityLoading] = useState(false);
    const [activitySearch, setActivitySearch] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboardData();
        loadUsers();
    }, []);

    useEffect(() => {
        let eventSource;
        if (tabValue === 1) {
            loadActivity();
            const base = window.location;
            const port = process.env.REACT_APP_BACKEND_PORT || 5007;
            const url = `${base.protocol}//${base.hostname}:${port}/api/admin/activity/stream`;
            eventSource = new EventSource(url);
            eventSource.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data && data.type === 'activity') {
                        // Prepend the new activity and cap list
                        setActivity((prev) => {
                            const items = [data.payload, ...(prev.items || [])].slice(0, prev.pageSize || 50);
                            return { ...prev, items };
                        });
                    }
                } catch (_) {}
            };
        } else if (tabValue === 2) {
            loadAnalytics();
        }
        return () => {
            if (eventSource) {
                try { eventSource.close(); } catch (_) {}
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabValue]);

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
        if (tabValue === 1) loadActivity();
        if (tabValue === 2) loadAnalytics();
    };

    const loadActivity = async (page = 1, search = activitySearch) => {
        try {
            setActivityLoading(true);
            const response = await getActivityLogs({ page, limit: 50, search });
            setActivity({ ...response.data });
        } catch (err) {
            console.error('Error loading activity logs:', err);
            setError('Failed to load activity logs');
        } finally {
            setActivityLoading(false);
        }
    };

    const loadAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            const response = await getActivitySummary({ days: 7 });
            setAnalytics(response.data);
        } catch (err) {
            console.error('Error loading analytics:', err);
            setError('Failed to load analytics');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        setIsAuthenticated(false);
        navigate('/');
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
                        <Tab label="All Users" />
                        <Tab label="Activity Logs" />
                        <Tab label="Analytics" />
                    </Tabs>
                </Box>

                {/* All Users Tab */}
                {tabValue === 0 && (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>User</TableCell>
                                    <TableCell>Last Used</TableCell>
                                    <TableCell>Requests</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{formatDate(user.lastUsed)}</TableCell>
                                        <TableCell>{user.totalRequests}</TableCell>
                                        <TableCell>
                                            <Button
                                                startIcon={<DeleteIcon />}
                                                color="error"
                                                size="small"
                                                onClick={async () => {
                                                    if (!window.confirm(`Delete user ${user.email}?`)) return;
                                                    try {
                                                        await deleteUserApi(user.id);
                                                        setSuccess(`Deleted ${user.email}`);
                                                        loadUsers();
                                                    } catch (err) {
                                                        setError('Failed to delete user');
                                                    }
                                                }}
                                            >
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Activity Logs Tab */}
                {tabValue === 1 && (
                    <Box>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}></Box>
                        {activityLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>When</TableCell>
                                            <TableCell>User</TableCell>
                                            <TableCell>Action</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Time (ms)</TableCell>
                                            <TableCell>IP</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {activity.items.map((log) => (
                                            <TableRow key={log._id}>
                                                <TableCell>{formatDate(log.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{log.username || log.email || log.userId || 'Unknown'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{log.email}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{log.action || `${log.method} ${log.endpoint}`}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={String(log.statusCode)} size="small" color={log.statusCode >= 400 ? 'error' : 'success'} />
                                                </TableCell>
                                                <TableCell>{log.responseTimeMs}</TableCell>
                                                <TableCell>-</TableCell>
                                            </TableRow>
                                        ))}
                                        {activity.items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">No activity found</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                            <Typography variant="body2">Total: {activity.total}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button disabled={activity.page <= 1} onClick={() => loadActivity(activity.page - 1)}>Prev</Button>
                                <Button disabled={(activity.page * activity.pageSize) >= activity.total} onClick={() => loadActivity(activity.page + 1)}>Next</Button>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Analytics Tab */}
                {tabValue === 2 && (
                    <Box>
                        {analyticsLoading || !analytics ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Requests by Day (last 7 days)</Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Date</TableCell>
                                                        <TableCell>Count</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {analytics.byDay.map((d) => (
                                                        <TableRow key={d._id}>
                                                            <TableCell>{d._id}</TableCell>
                                                            <TableCell>{d.count}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Top Endpoints</Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Endpoint</TableCell>
                                                        <TableCell>Requests</TableCell>
                                                        <TableCell>Avg ms</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {analytics.byEndpoint.map((e) => (
                                                        <TableRow key={e._id}>
                                                            <TableCell>{e._id}</TableCell>
                                                            <TableCell>{e.count}</TableCell>
                                                            <TableCell>{Math.round(e.avgResponseMs || 0)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Top Users</Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>User</TableCell>
                                                        <TableCell>Requests</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {analytics.byUser.map((u) => (
                                                        <TableRow key={(u._id && (u._id.userId || u._id.username || u._id.email)) || Math.random()}>
                                                            <TableCell>{u._id?.username || u._id?.email || u._id?.userId || 'Unknown'}</TableCell>
                                                            <TableCell>{u.count}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default AdminDashboard;
