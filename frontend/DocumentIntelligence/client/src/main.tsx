import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// import { Toaster } from "@/components/ui/toaster"; // Remove import

createRoot(document.getElementById("root")!).render(
  <>
    <App />
  </>
);
