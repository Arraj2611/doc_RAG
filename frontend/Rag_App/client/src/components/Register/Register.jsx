import React, { useState, useContext } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link } from "react-router-dom";
import "./Register.css";
import { Context } from "../../context/Context";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
  });
  const { register } = useContext(Context);
  const navigate = useNavigate();

  const handleInput = (event) => {
    setUserDetails((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("http://localhost:7000/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userDetails),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setUserDetails({
          name: "",
          email: "",
          password: "",
          age: "",
        });
        register(userDetails.name, userDetails.email, userDetails.password);
        navigate("/app", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.log("Registration error:", err);
      // In case of a connection error, use the mock register function
      toast.info("Using demo mode registration (backend unavailable)");
      register(userDetails.name, userDetails.email, userDetails.password);
      navigate("/app");
    }
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Register To Use</h2>
        <div className="input-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            placeholder="Enter your name"
            value={userDetails.name}
            onChange={handleInput}
            required
            name="name"
          />
        </div>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={userDetails.email}
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
            value={userDetails.password}
            onChange={handleInput}
            required
            name="password"
          />
        </div>
        <button type="submit" className="register-button">
          REGISTER
        </button>
        <p className="login-link">
          Already Registered? <Link to="/login">Login</Link>
        </p>
      </form>
      <ToastContainer />
    </div>
  );
};

export default Register;


