/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */

// import { createContext, useState } from "react";
// import runChat from "../config/gemini";

// export const Context = createContext();

// const ContextProvider = (props) => {
//   const [input, setInput] = useState("");
//   const [recentPrompt, setRecentPrompt] = useState("");
//   const [prevPrompts, setPrevPrompts] = useState([]);
//   const [showResult, setShowResult] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [resultData, setResultData] = useState("");

//   const delayPara = (index, nextWord) => {
//     setTimeout(function () {
//       setResultData((prev) => prev + nextWord);
//     });
//   };

//   const onSent = async (prompt) => {
//     setResultData("");
//     setLoading(true);
//     setShowResult(true);
//     setRecentPrompt(input);
//     setPrevPrompts((prev) => [...prev, input]);
//     const response = await runChat(input);
//     let responseArray = response.split("**");
//     let newResponse;
//     for (let i = 0; i < responseArray.length; i++) {
//       if (i === 0 || i % 2 !== 1) {
//         newResponse += "<b>" + responseArray[i] + "</b>";
//       } else {
//         newResponse += "<b>" + responseArray[i] + "</b>";
//       }
//     }
//     let newResponse2 = newResponse2.split("*").join("</br>");
//     let newResponseArray = newResponse2.split(" ");
//     for (let i = 0; i < newResponseArray.length; i++) {
//       const nextWord = newResponseArray[i];
//       delayPara(i, nextWord + " ");
//     }
//     setLoading(false);
//     setInput("");
//   };

//   const contextValue = {
//     prevPrompts,
//     setPrevPrompts,
//     onSent,
//     setRecentPrompt,
//     recentPrompt,
//     showResult,
//     loading,
//     resultData,
//     input,
//     setInput,
//   };
//   return (
//     <Context.Provider value={contextValue}>{props.children}</Context.Provider>
//   );
// };

// export default ContextProvider;




// Context.jsx
import { createContext, useState } from "react";
import runChat from "../config/gemini";

export const Context = createContext();

const ContextProvider = (props) => {
  const [input, setInput] = useState("");
  const [recentPrompt, setRecentPrompt] = useState("");
  const [prevPrompts, setPrevPrompts] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState("");

  const delayPara = (index, nextWord) => {
    setTimeout(() => {
      setResultData((prev) => prev + nextWord);
    }, index * 100); // Adjust delay as needed
  };

  const onSent = async (prompt) => {
    setResultData("");
    setLoading(true);
    setShowResult(true);
    setRecentPrompt(input);
    setPrevPrompts((prev) => [...prev, input]);

    const response = await runChat(input);
    let responseArray = response.split("**");
    let newResponse = ""; // Initialize as an empty string

    for (let i = 0; i < responseArray.length; i++) {
      newResponse += `<b>${responseArray[i]}</b>`;
    }

    let formattedResponse = newResponse.split("*").join("<br>");
    let newResponseArray = formattedResponse.split(" ");

    newResponseArray.forEach((word, index) => {
      delayPara(index, word + " ");
    });

    setLoading(false);
    setInput("");
  };

  const contextValue = {
    prevPrompts,
    setPrevPrompts,
    onSent,
    setRecentPrompt,
    recentPrompt,
    showResult,
    loading,
    resultData,
    input,
    setInput,
  };

  return (
    <Context.Provider value={contextValue}>{props.children}</Context.Provider>
  );
};

export default ContextProvider;
