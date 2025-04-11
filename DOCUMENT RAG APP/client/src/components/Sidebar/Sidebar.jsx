import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Sidebar.css";
import { assets } from "../../assets/assets";

const Sidebar = () => {
  const [extended, setExtended] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Show toast message if it exists and hasn't been shown yet in this session
    if (location.state?.toastMessage && !sessionStorage.getItem("toastShown")) {
      toast.success(location.state.toastMessage);
      sessionStorage.setItem("toastShown", "true"); // Set flag to prevent repeat
    }
  }, [location.state]);

  return (
    <div className={`sidebar ${extended ? "extended" : ""}`}>
      <div className="top">
        <img
          onClick={() => setExtended((prev) => !prev)}
          className="menu"
          src={assets.menu_icon}
          alt="Menu"
        />
        <div className="new-chat">
          <img src={assets.plus_icon} alt="New Chat" />
          {extended && <p>New Chat</p>}
        </div>
        {extended && (
          <div className="recent">
            <p className="recent_title">Recent</p>
            <div className="recent-entry">
              <img className="msg" src={assets.message_icon} alt="Message" />
              <p>What Is React..</p>
            </div>
          </div>
        )}
      </div>

      <div className="bottom">
        <div className="bottom-item recent-entry">
          <img src={assets.question_icon} alt="Help" />
          {extended && <p>Help</p>}
        </div>
        <div className="bottom-item recent-entry">
          <img src={assets.history_icon} alt="Activity" />
          {extended && <p>Activity</p>}
        </div>
        <div className="bottom-item recent-entry">
          <img src={assets.setting_icon} alt="Settings" />
          {extended && <p>Settings</p>}
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Sidebar;
