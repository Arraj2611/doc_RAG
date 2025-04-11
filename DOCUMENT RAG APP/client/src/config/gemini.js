// gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// const apiKey = "AIzaSyDf5q_A8gUIr9XsylvJfDAPwGj6h_A3We8";
// const apiKey = "AIzaSyApysH4zYv24l7HF4rWJYNj42YRp-CgJuU";
const apiKey = "AIzaSyA2c-PTw6blk4Mv2zNpBvYBosbvnqSJR2o";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function runChat(prompt) {
  const chatSession = model.startChat({
    generationConfig,
    history: [],
  });

  const result = await chatSession.sendMessage(prompt);
  const responseText = await result.response.text(); // Await the response text
  console.log(responseText);
  return responseText;
}

export default runChat;
