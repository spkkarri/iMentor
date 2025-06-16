// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js'; 
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);

export const DEV_MODE_ALLOW_DEV_LOGIN = false;

export const AuthProvider = ({ children }) => {
    const [token, setTokenState] = useState(localStorage.getItem('authToken'));
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);

    const setToken = (newToken) => {
        if (newToken) localStorage.setItem('authToken', newToken);
        else localStorage.removeItem('authToken');
        setTokenState(newToken);
    };

    const setUser = (newUser) => setUserState(newUser);
    
    const processAuthData = useCallback((authApiResponse) => {
        if (authApiResponse && authApiResponse.token && authApiResponse._id && authApiResponse.email) {
            setToken(authApiResponse.token);
            setUser({ id: authApiResponse._id, email: authApiResponse.email });
            console.log("AuthContext: User and Token set.", { email: authApiResponse.email });
            return authApiResponse; 
        } else {
            setToken(null);
            setUser(null);
            console.error("AuthContext: processAuthData received incomplete data for a regular user.", authApiResponse);
            throw new Error("Authentication response from server was incomplete for a regular user.");
        }
    }, []);

    useEffect(() => {
        const verifyTokenAndLoadUser = async () => {
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                setTokenState(storedToken);
                try {
                    const userDataFromMe = await api.getMe();
                    if (userDataFromMe && userDataFromMe._id && userDataFromMe.email) {
                        setUser({ id: userDataFromMe._id, email: userDataFromMe.email });
                    } else {
                        setToken(null);
                        setUser(null);
                    }
                } catch (error) {
                    setToken(null);
                    setUser(null);
                }
            }
            setLoading(false);
        };
        verifyTokenAndLoadUser();
    }, []);

    const login = async (credentials) => {
        setLoading(true);
        try {
            const data = await api.login(credentials);
            // --- THIS IS THE FIX ---
            // If the response is a special case for admin login,
            // bypass the standard token processing and return it directly.
            if (data && data.isAdminLogin) {
                return data;
            }
            // Otherwise, process it as a regular user with a JWT token.
            return processAuthData(data);
            // --- END OF FIX ---
        } catch (error) {
            setToken(null); 
            setUser(null);
            throw error; 
        } finally {
            setLoading(false);
        }
    };
    
    const signup = async (signupData) => {
        setLoading(true);
        try {
            const data = await api.signup(signupData);
            return processAuthData(data); // Signup always returns a regular user
        } catch (error) {
            setToken(null);
            setUser(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        console.log("AuthContext: Logging out user.");
        setToken(null); 
        setUser(null);
        toast.success("You have been logged out.");
    };

    return (
        <AuthContext.Provider value={{ token, user, loading, login, signup, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};