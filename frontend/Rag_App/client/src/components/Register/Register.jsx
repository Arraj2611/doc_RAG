import React, { useState, useContext } from "react";
import { ToastContainer, toast } from "react-toastify"; // Keep toast imports if ToastContainer is used
import "react-toastify/dist/ReactToastify.css"; // Keep CSS
import { Link } from "react-router-dom"; // useNavigate is handled by context
import "./Register.css";
import { Context } from "../../context/Context";
// import { useNavigate } from "react-router-dom"; // No longer needed

const Register = () => {
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    password: "",
    // age: "", // Removed age
  });
  const { register } = useContext(Context); // Get register function
  // const navigate = useNavigate(); // No longer needed

  const handleInput = (event) => {
    setUserDetails((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Directly call the register function from context
    await register(userDetails.name, userDetails.email, userDetails.password);

    // Remove the old fetch call and try/catch block
    /*
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
        setUserDetails({ name: "", email: "", password: "" });

        // Call context register function if needed (e.g., to set auth state)
        // register(userDetails.name, userDetails.email, userDetails.password); 

        navigate("/login", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error("Registration error:", err);
      toast.error("Could not register");
      // Fallback using context register (which might also fail if backend is down)
      // register(userDetails.name, userDetails.email, userDetails.password);
      // navigate("/app"); // Or maybe navigate to login?
    }
    */
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
            name="name"
            placeholder="Enter your name"
            value={userDetails.name}
            onChange={handleInput}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={userDetails.email}
            onChange={handleInput}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter your password"
            value={userDetails.password}
            onChange={handleInput}
            required
          />
        </div>
        {/* Remove Age input field */}
        {/* <div className="input-group"> ... </div> */}
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


