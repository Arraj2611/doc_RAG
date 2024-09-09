import React from "react";
import { useTheme } from "../ThemeContext";

const Home = () => {
  const { theme, toggleTheme } = useTheme();

  const homeStyle = {
    backgroundColor: theme === "light" ? "#fff" : "#333",
    color: theme === "light" ? "#000" : "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={homeStyle}>
      <h1>Welcome to the Home Page</h1>
      <button onClick={toggleTheme}>
        Switch to {theme === "light" ? "Dark" : "Light"} Mode
      </button>
    </div>
  );
};

export default Home;
