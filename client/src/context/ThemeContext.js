import React, { createContext, useState, useContext, useEffect } from 'react';

// Create a Context object.
const ThemeContext = createContext();

/**
 * The ThemeProvider component is a wrapper that provides theme-related
 * state and functions to all child components.
 */
export const ThemeProvider = ({ children }) => {
  // State to hold the current theme. We'll default to 'dark' and also
  // check localStorage for a previously saved user preference.
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    // We check if savedTheme is valid to avoid issues.
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  });

  // useEffect hook to apply changes whenever the theme state updates.
  useEffect(() => {
    // 1. Update the 'data-theme' attribute on the root <html> element.
    //    This is how our CSS variables in index.css will be activated.
    document.documentElement.setAttribute('data-theme', theme);

    // 2. Save the user's theme preference to localStorage for persistence.
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Function to toggle the theme between 'light' and 'dark'.
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Provide the theme state and the toggle function to children components.
  const value = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * A custom hook 'useTheme' to easily access the ThemeContext value.
 * This simplifies theme consumption in other components.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};