import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signinUser, signupUser } from '../services/api';

const AuthPage = ({ setIsAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!username.trim() || !password.trim()) {
      setError('Username and password cannot be empty.');
      setLoading(false);
      return;
    }
    try {
      let response;
      const userData = { username, password };

      if (isLogin) {
        response = await signinUser(userData);
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        response = await signupUser(userData);
      }

      const { sessionId, username: loggedInUsername, _id: userId } = response.data;
      if (!userId || !sessionId || !loggedInUsername) {
        throw new Error("Incomplete authentication data received from server.");
      }
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('username', loggedInUsername);
      localStorage.setItem('userId', userId);
      setIsAuthenticated(true);
      navigate('/chat', { replace: true });
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(errorMessage);
      console.error("Auth Error:", err.response || err);
      localStorage.removeItem('sessionId');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isLogin ? 'Sign In' : 'Create your account'}</h2>
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="bottom-text">
          {isLogin ? (
            <>
              Don’t have an account?{' '}
              <span className="link-text" onClick={toggleMode}>
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span className="link-text" onClick={toggleMode}>
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Professional CSS Injection ---
const AuthPageCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(145deg, #0f2027, #203a43, #2c5364);
  font-family: 'Inter', sans-serif;
  padding: 20px;
}

.auth-box {
  background: #ffffff;
  padding: 50px 40px;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 420px;
  text-align: center;
  transition: transform 0.3s ease;
}

.auth-box h2 {
  margin-bottom: 30px;
  color: #222;
  font-size: 1.75rem;
  font-weight: 700;
}

.input-group {
  margin-bottom: 25px;
  text-align: left;
}

.input-group label {
  display: block;
  margin-bottom: 8px;
  color: #444;
  font-weight: 600;
  font-size: 0.95rem;
}

.input-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  background-color: #f8f9fa;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-group input:focus {
  outline: none;
  border-color: #4dabf7;
  box-shadow: 0 0 0 3px rgba(77, 171, 247, 0.25);
}

.input-group input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.auth-button {
  width: 100%;
  padding: 14px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
  transition: background 0.3s ease;
}

.auth-button:hover:not(:disabled) {
  background: #0056b3;
}

.auth-button:disabled {
  background: #b0b0b0;
  cursor: not-allowed;
}

.bottom-text {
  margin-top: 25px;
  font-size: 0.92rem;
  color: #333;
}

.link-text {
  color: #007bff;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.link-text:hover {
  text-decoration: underline;
  color: #0056b3;
}

.error-message {
  color: #dc3545;
  margin-top: 12px;
  font-size: 0.88rem;
  text-align: left;
  font-weight: 500;
}
`;

const styleTagAuthId = 'auth-page-styles';
if (!document.getElementById(styleTagAuthId)) {
  const styleTag = document.createElement("style");
  styleTag.id = styleTagAuthId;
  styleTag.type = "text/css";
  styleTag.innerText = AuthPageCSS;
  document.head.appendChild(styleTag);
}

export default AuthPage;
