import bcrypt from "bcrypt"; // Library for hashing passwords

import jwt from "jsonwebtoken"; // Library for creating JSON Web Tokens
import userModel from "../models/userModel.js"; // Importing the user model

// Register user
const registerUser = async (req, res) => {
  const { name, email, password, age } = req.body;
  try {
    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      // Respond with a 400 status if user already exists
      return res.status(400).send({ message: "User already exists" });
    }

    // Generate salt for hashing the password
    const salt = await bcrypt.genSalt(10);
    // Hash the password using the generated salt
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user object with hashed password
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      age,
    });

    // Save the new user to the database
    const savedUser = await newUser.save();

    // Respond with a 201 status and the saved user object
    res.status(201).send({ message: "User Registered", user: savedUser });
  } catch (err) {
    console.error(err); // Log the error for debugging
    // Respond with a 500 status in case of server error
    res.status(500).send({ message: "Some Problem" });
  }
};



// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Find the user by email
    const user = await userModel.findOne({ email });
    if (!user) {
      // Respond with a 404 status if user is not found
      return res.status(404).send({ message: "Invalid Email" });
    }

    // Compare the provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Respond with a 403 status if passwords do not match
      return res.status(403).send({ message: "Incorrect password" });
    }

    // Generate a JSON Web Token
    const token = jwt.sign(
      { email: user.email, userId: user._id },
      process.env.JWT_SECRET || "nutrifyapp", // Use environment variable for JWT secret
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // Respond with the token and user details
    res.send({
      message: "Login Success",
      token,
      userId: user._id,
      name: user.name,
    });
  } catch (err) {
    console.error(err); // Log the error for debugging
    // Respond with a 500 status in case of server error
    res.status(500).send({ message: "Some Problem" });
  }
};

export default { registerUser, loginUser }; // Export the register and login functions
