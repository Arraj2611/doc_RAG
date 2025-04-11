import { useContext } from "react";
import "./Main.css";
import { assets } from "../../assets/assets";
import { Context } from "../../context/Context";

const Main = () => {
  const {
    onSent,
    recentPrompt,
    showResult,
    loading,
    resultData,
    setInput,
    input,
  } = useContext(Context);

  // Function to handle PDF upload
  const handlePdfUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      // Handle PDF file upload logic here, such as sending to backend
      console.log("PDF file uploaded:", file);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  // Function to trigger the hidden file input
  const triggerPdfUpload = () => {
    document.getElementById("pdfUpload").click();
  };

  return (
    <div className="main">
      <div className="nav">
        <p>RagChatApp</p>
        <img src={assets.user_icon} alt="User icon" />
      </div>
      <div className="main-container">
        {!showResult ? (
          <>
            <div className="greet">
              <p>
                <span>Hello.........</span>
              </p>
              <p></p>
            </div>
          </>
        ) : (
          <div className="result">
            <div className="result-title">
              <img src={assets.user_icon} alt="User icon" />
              <p>{recentPrompt}</p>
            </div>
            <div className="result-data">
              <img src={assets.gemini_icon} alt="Gemini icon" />
              {loading ? (
                <div className="loader">
                  <hr />
                  <hr />
                  <hr />
                </div>
              ) : (
                <p dangerouslySetInnerHTML={{ __html: resultData }}></p>
              )}
            </div>
          </div>
        )}

        <div className="main-bottom">
          <div className="search-box">
            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              type="text"
              placeholder="Enter a prompt here"
            />
            <div>
              <img
                src={assets.pdf_icon}
                alt="Gallery icon"
                onClick={triggerPdfUpload}
              />
              <input
                id="pdfUpload"
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={handlePdfUpload}
              />
              <img src={assets.mic_icon} alt="Mic icon" />
              <img
                onClick={() => onSent(input)}
                src={assets.send_icon}
                alt="Send icon"
              />
            </div>
          </div>
          <p className="bottom-info"></p>
        </div>
      </div>
    </div>
  );
};

export default Main;
