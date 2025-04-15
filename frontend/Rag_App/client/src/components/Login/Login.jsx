import React, { useState, useContext } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { Context } from "../../context/Context";

const Login = () => {
  const [loginDetails, setLoginDetails] = useState({
    email: "",
    password: "",
  });

  // Remove unused navigate hook from here
  // const navigate = useNavigate();
  const { login } = useContext(Context);

  const handleInput = (event) => {
    setLoginDetails((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Directly call the login function from the context
    // The context function will handle API call, state updates, and navigation
    await login(loginDetails.email, loginDetails.password);

    // Remove the old fetch call and error handling block
    /*
    try {
      const response = await fetch("http://localhost:7000/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginDetails),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setLoginDetails({ email: "", password: "" });

        login(loginDetails.email, loginDetails.password);

        navigate("/app", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.log("Login error:", err);
      // In case of a connection error, use the mock login function
      toast.info("Using demo mode login (backend unavailable)");
      login(loginDetails.email, loginDetails.password);
      navigate("/app");
    }
    */
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Login To Use</h2>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={loginDetails.email}
            onChange={handleInput}
            required
            name="email"
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={loginDetails.password}
            onChange={handleInput}
            required
            name="password"
          />
        </div>
        <button type="submit" className="register-button">
          LOGIN
        </button>
        <p className="login-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
      <ToastContainer />
    </div>
  );
};

export default Login;
