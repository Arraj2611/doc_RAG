import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link } from "react-router-dom";

const Register = () => {
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
  });


  const handleInput = (event) => {
    setUserDetails((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      // Send a POST request to the registration endpoint
      const response = await fetch("http://localhost:7000/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userDetails),
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Parse the JSON response
      const data = await response.json();

      if (response.ok) {
        // Show success toast notification
        toast.success(data.message);

        // Reset the user details state
        setUserDetails({
          name: "",
          email: "",
          password: "",
          age: "",
        });
      } else {
        // Show error toast notification with message from response
        toast.error(data.message);
      }
    } catch (err) {
      console.log(err);
      // Show error toast notification
      toast.error("Registration failed. Please try again.");
    }
  };

  return (
    <section className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h1>Register To Use</h1>
        <input
          className="inp"
          type="text"
          onChange={handleInput}
          placeholder="Enter Your Name"
          value={userDetails.name}
          required
          name="name"
        />
        <input
          className="inp"
          type="email"
          onChange={handleInput}
          placeholder="Enter Your Email"
          value={userDetails.email}
          required
          name="email"
        />
        <input
          className="inp"
          type="password"
          onChange={handleInput}
          placeholder="Enter Your Password"
          value={userDetails.password}
          required
          name="password"
        />
        <button className="btn" type="submit">
          Register
        </button>
        <p>
          Already Registered? <Link to="/login">Login</Link>
        </p>
      </form>
      <ToastContainer />
    </section>
  );
};

export default Register;


