import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Auth.css';

function Auth() {
  useEffect(() => {
    document.body.style.background = '';
    document.body.style.color = '';
  }, []);

  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overGoogle, setOverGoogle] = useState(false);

  // Robot position state
  const [robotPos, setRobotPos] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    // Simulate loading
    setSuccess('🔄 Logging in...');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setSuccess('✅ Login successful!');
      localStorage.setItem('jwt', data.token);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setSuccess('');
      setError(data.error || 'Login failed');
    }
  };

  const handleSignup = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSuccess('🔄 Signing up...');
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username,
        email: form.email,
        password: form.password,
        phone: form.phone
      })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setSuccess('🎉 Signup successful!');
      localStorage.setItem('jwt', data.token);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setSuccess('');
      setError(data.error || 'Signup failed');
    }
  };

  const handleGoogleLogin = () => {
    setSuccess('🌐 Redirecting to Google...');
    setTimeout(() => {
      window.location.href = '/login/google';
    }, 800);
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <BigRobot x={robotPos.x} y={robotPos.y} />
      </div>
      <motion.div
        className="auth-container"
        ref={containerRef}
        style={{ overflow: "hidden", position: "relative", zIndex: 1 }}
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 12 }}
        onMouseMove={e => {
          if (overGoogle) return; // Don't move robot if over Google button
          const rect = containerRef.current.getBoundingClientRect();
          setRobotPos({
            x: e.clientX - rect.left - 175, // 175 = half SVG width
            y: e.clientY - rect.top - 250,  // 250 = half SVG height
          });
        }}
      >
        {/* Robot background, always rendered first and behind form */}
        <BigRobot x={robotPos.x} y={robotPos.y} />

        <motion.h2
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isLogin ? '🔐 Login' : '📝 Sign Up'} to Local AI Engineering Tutor
        </motion.h2>
        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : 'signup'}
            onSubmit={isLogin ? handleLogin : handleSignup}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
          >
            {!isLogin && (
              <>
                <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
                <input type="text" name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} required />
              </>
            )}
            <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
            <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
            {!isLogin && (
              <input type="password" name="confirmPassword" placeholder="Confirm Password" value={form.confirmPassword} onChange={handleChange} required />
            )}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  ❌ {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  className="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="submit"
              className="btn btn-primary"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.04 }}
            >
              {isLogin ? 'Login 🚀' : 'Sign Up 🎉'}
            </motion.button>
            {isLogin && (
              <button
                type="button"
                className="btn btn-google"
                style={{ marginTop: '1rem' }}
                onClick={handleGoogleLogin}
                onMouseEnter={() => setOverGoogle(true)}
                onMouseLeave={() => setOverGoogle(false)}
              >
                Continue With Google 🌐
              </button>
            )}
          </motion.form>
        </AnimatePresence>
        <div style={{ marginTop: '1rem' }}>
          {isLogin ? (
            <span>
              Don't have an account?
              <button onClick={() => setIsLogin(false)} className="link-btn">Sign Up</button>
            </span>
          ) : (
            <span>
              Already have an account?
              <button onClick={() => setIsLogin(true)} className="link-btn">Login</button>
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function BigRobot({ x, y }) {
  return (
    <motion.div
      className="big-robot"
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 60, damping: 12 }}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Simple SVG robot illustration */}
      <svg width="350" height="500" viewBox="0 0 350 500" fill="none">
        {/* Body */}
        <rect x="75" y="150" width="200" height="220" rx="40" fill="#ffd700" stroke="#222" strokeWidth="8"/>
        {/* Head */}
        <rect x="100" y="60" width="150" height="100" rx="30" fill="#ffd700" stroke="#222" strokeWidth="8"/>
        {/* Eyes */}
        <ellipse cx="140" cy="110" rx="15" ry="15" fill="#222"/>
        <ellipse cx="210" cy="110" rx="15" ry="15" fill="#222"/>
        {/* Mouth */}
        <rect x="150" y="140" width="50" height="10" rx="5" fill="#222"/>
        {/* Antenna */}
        <rect x="170" y="30" width="10" height="40" rx="5" fill="#ffd700" stroke="#222" strokeWidth="4"/>
        <circle cx="175" cy="25" r="10" fill="#e94560" stroke="#222" strokeWidth="4"/>
        {/* Arms */}
        <rect x="35" y="200" width="40" height="120" rx="20" fill="#ffd700" stroke="#222" strokeWidth="8"/>
        <rect x="275" y="200" width="40" height="120" rx="20" fill="#ffd700" stroke="#222" strokeWidth="8"/>
        {/* Legs */}
        <rect x="110" y="370" width="30" height="90" rx="15" fill="#ffd700" stroke="#222" strokeWidth="8"/>
        <rect x="210" y="370" width="30" height="90" rx="15" fill="#ffd700" stroke="#222" strokeWidth="8"/>
      </svg>
    </motion.div>
  );
}

export default Auth;