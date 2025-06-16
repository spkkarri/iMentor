import React, { useState } from 'react';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [error, setError] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    // POST to your Flask backend login endpoint
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('jwt', data.token);
      window.location.reload();
    } else {
      setError(data.error || 'Login failed');
    }
  };

  const handleSignup = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    // POST to your Flask backend signup endpoint
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
      localStorage.setItem('jwt', data.token);
      window.location.reload();
    } else {
      setError(data.error || 'Signup failed');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/login/google';
  };

  const handleGoogleSignup = () => {
    window.location.href = '/signup/google';
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Sign Up'} to Local AI Engineering Tutor</h2>
      <form onSubmit={isLogin ? handleLogin : handleSignup}>
        {!isLogin && (
          <>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </>
        )}
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        {!isLogin && (
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        )}
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn-primary">
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
      <button className="btn btn-google" onClick={isLogin ? handleGoogleLogin : handleGoogleSignup}>
        {isLogin ? 'Login with Google' : 'Sign Up with Google'}
      </button>
      <div style={{ marginTop: '1rem' }}>
        {isLogin ? (
          <span>
            Don't have an account?{' '}
            <button onClick={() => setIsLogin(false)} className="link-btn">Sign Up</button>
          </span>
        ) : (
          <span>
            Already have an account?{' '}
            <button onClick={() => setIsLogin(true)} className="link-btn">Login</button>
          </span>
        )}
      </div>
    </div>
  );
}

export default Auth;