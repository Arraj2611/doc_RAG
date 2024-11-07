// import React, { useState } from "react";
// import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import { Link, useNavigate } from "react-router-dom";
// import "./Login.css";


// const Login = () => {
//   const [loginDetails, setLoginDetails] = useState({
//     email: "",
//     password: "",
//   });

//   const navigate = useNavigate();

//   // Handle input change and update login details state
//   const handleInput = (event) => {
//     setLoginDetails((prevState) => ({
//       ...prevState,
//       [event.target.name]: event.target.value,
//     }));
//   };

//   // Handle form submission
//   const handleSubmit = async (event) => {
//     event.preventDefault();

//     try {
//       // Send a POST request to the login endpoint
//       const response = await fetch("http://localhost:7000/api/auth/login", {
//         method: "POST",
//         body: JSON.stringify(loginDetails),
//         headers: {
//           "Content-Type": "application/json",
//         },
//       });

//       // Parse the JSON response
//       const data = await response.json();

//       if (response.ok) {
//         // Show success toast notification
//         toast.success(data.message);

//         // Reset the login details state
//         setLoginDetails({
//           email: "",
//           password: "",
//         });

//         // Redirect to the home page upon successful login
//         navigate("/sidebar");
//       } else {
//         // Show error toast notification with message from response
//         toast.error(data.message);
//       }
//     } catch (err) {
//       console.log(err);
//       // Show error toast notification
//       toast.error("Login failed. Please try again.");
//     }
//   };

//   return (
//     <section className="container">
//       <form className="form" onSubmit={handleSubmit}>
//         <h1>Login...</h1>
//         <input
//           className="inp"
//           type="email"
//           onChange={handleInput}
//           placeholder="Enter Your Email"
//           value={loginDetails.email}
//           required
//           name="email"
//         />
//         <input
//           className="inp"
//           type="password"
//           onChange={handleInput}
//           placeholder="Enter Your Password"
//           value={loginDetails.password}
//           required
//           name="password"
//         />
//         <button className="btn" type="submit">
//           Login
//         </button>
//         <p>
//           Don't have an account? <Link to="/register">Register</Link>
//         </p>
//       </form>
//       <ToastContainer />
//     </section>
//   );
// };

// export default Login;




import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [loginDetails, setLoginDetails] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleInput = (event) => {
    setLoginDetails((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
        
        // Navigate to Sidebar and pass a success message
        navigate("/sidebar", { state: { toastMessage: data.message } });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.log(err);
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <section className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h1>Login</h1>
        <input
          className="inp"
          type="email"
          onChange={handleInput}
          placeholder="Enter Your Email"
          value={loginDetails.email}
          required
          name="email"
        />
        <input
          className="inp"
          type="password"
          onChange={handleInput}
          placeholder="Enter Your Password"
          value={loginDetails.password}
          required
          name="password"
        />
        <button className="btn" type="submit">
          Login
        </button>
        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
      <ToastContainer />
    </section>
  );
};

export default Login;
