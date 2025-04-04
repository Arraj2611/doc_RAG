// frontend/Rag_App/client/src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect, useMemo } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Default to 'light' or load preference from localStorage
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('appTheme');
        // Check system preference if no saved theme
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light'); // Default based on system or light
    });

    useEffect(() => {
        // Apply theme class to body and save preference
        document.body.className = theme; // Remove previous classes if any
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Use useMemo to prevent unnecessary re-renders of context consumers
    const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};