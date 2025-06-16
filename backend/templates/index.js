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

  return React.createElement(
    'div',
    { className: 'auth-container' },
    React.createElement(
      'h2',
      null,
      (isLogin ? 'Login' : 'Sign Up') + ' to Local AI Engineering Tutor'
    ),
    React.createElement(
      'form',
      { onSubmit: isLogin ? handleLogin : handleSignup },
      !isLogin &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement('input', {
            type: 'text',
            name: 'username',
            placeholder: 'Username',
            value: form.username,
            onChange: handleChange,
            required: true
          }),
          React.createElement('input', {
            type: 'text',
            name: 'phone',
            placeholder: 'Phone Number',
            value: form.phone,
            onChange: handleChange,
            required: true
          })
        ),
      React.createElement('input', {
        type: 'email',
        name: 'email',
        placeholder: 'Email',
        value: form.email,
        onChange: handleChange,
        required: true
      }),
      React.createElement('input', {
        type: 'password',
        name: 'password',
        placeholder: 'Password',
        value: form.password,
        onChange: handleChange,
        required: true
      }),
      !isLogin &&
        React.createElement('input', {
          type: 'password',
          name: 'confirmPassword',
          placeholder: 'Confirm Password',
          value: form.confirmPassword,
          onChange: handleChange,
          required: true
        }),
      error &&
        React.createElement(
          'div',
          { className: 'error' },
          error
        ),
      React.createElement(
        'button',
        { type: 'submit', className: 'btn btn-primary' },
        isLogin ? 'Login' : 'Sign Up'
      )
    ),
    React.createElement(
      'button',
      {
        className: 'btn btn-google',
        onClick: isLogin ? handleGoogleLogin : handleGoogleSignup
      },
      isLogin ? 'Login with Google' : 'Sign Up with Google'
    ),
    React.createElement(
      'div',
      { style: { marginTop: '1rem' } },
      isLogin
        ? React.createElement(
            'span',
            null,
            "Don't have an account? ",
            React.createElement(
              'button',
              {
                onClick: () => setIsLogin(false),
                className: 'link-btn'
              },
              'Sign Up'
            )
          )
        : React.createElement(
            'span',
            null,
            'Already have an account? ',
            React.createElement(
              'button',
              {
                onClick: () => setIsLogin(true),
                className: 'link-btn'
              },
              'Login'
            )
          )
    )
  );
}

export default Auth;