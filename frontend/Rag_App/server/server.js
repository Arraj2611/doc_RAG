// This file now just needs to execute app.js
import app from "./app.js";

const PORT = process.env.PORT || 3001; // Use 3001 as default, or override with .env

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
