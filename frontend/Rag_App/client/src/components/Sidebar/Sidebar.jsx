import React, { useState, useContext } from "react";
import "./Sidebar.css";
import { assets } from "../../assets/assets";
import { Context } from "../../context/Context";
import { ThemeContext } from "../../context/ThemeContext";

const Sidebar = () => {
  const [extended, setExtended] = useState(false);

  const {
    chatSessions,
    currentSessionId,
    startNewChat,
    selectChat,
  } = useContext(Context);

  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div className={`sidebar ${extended ? "extended" : ""}`}>
      <div className="top">
        <img
          onClick={() => setExtended((prev) => !prev)}
          className="menu"
          src={assets.menu_icon}
          alt="Menu"
        />
        <div onClick={startNewChat} className="new-chat">
          <img src={assets.plus_icon} alt="New Chat" />
          {extended ? <p>New Chat</p> : null}
        </div>
        {extended && chatSessions && chatSessions.length > 0 ? (
          <div className="recent">
            <p className="recent-title">Recent</p>
            {chatSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => selectChat(session.id)}
                className={`recent-entry ${session.id === currentSessionId ? 'active' : ''}`}
              >
                <img src={assets.message_icon} alt="Chat" />
                <p>{session.title || "Untitled Chat"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="bottom">
        <div className="bottom-item recent-entry">
          <img src={assets.question_icon} alt="Help" />
          {extended ? <p>Help</p> : null}
        </div>

        <div className="bottom-item recent-entry">
          <img src={assets.history_icon} alt="Activity" />
          {extended ? <p>Activity</p> : null}
        </div>

        <div onClick={toggleTheme} className="bottom-item recent-entry theme-toggle" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
          <img src={theme === 'light' ? assets.bulb_icon : assets.setting_icon} alt="Toggle Theme" />
          {extended ? <p>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</p> : null}
        </div>

        <div className="bottom-item recent-entry">
          <img src={assets.setting_icon} alt="Settings" />
          {extended ? <p>Settings</p> : null}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;



// import React, { useState, useEffect } from "react";
// import { useLocation } from "react-router-dom";
// import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import "./Sidebar.css";
// import { assets } from "../../assets/assets";

// const Sidebar = () => {
//   const [extended, setExtended] = useState(false);
//   const location = useLocation();

//   useEffect(() => {
//     // Show success message if passed from login
//     if (location.state?.toastMessage) {
//       toast.success(location.state.toastMessage);
//     }
//   }, [location.state]);

//   return (
//     <div className={`sidebar ${extended ? "extended" : ""}`}>
//       <div className="top">
//         <img
//           onClick={() => setExtended((prev) => !prev)}
//           className="menu"
//           src={assets.menu_icon}
//           alt="Menu"
//         />
//         <div className="new-chat">
//           <img src={assets.plus_icon} alt="New Chat" />
//           {extended && <p>New Chat</p>}
//         </div>
//         {extended && (
//           <div className="recent">
//             <p className="recent_title">Recent</p>
//             <div className="recent-entry">
//               <img src={assets.message_icon} alt="Message" />
//               <p>What Is React..</p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="bottom">
//         <div className="bottom-item recent-entry">
//           <img src={assets.question_icon} alt="Help" />
//           {extended && <p>Help</p>}
//         </div>
//         <div className="bottom-item recent-entry">
//           <img src={assets.history_icon} alt="Activity" />
//           {extended && <p>Activity</p>}
//         </div>
//         <div className="bottom-item recent-entry">
//           <img src={assets.setting_icon} alt="Settings" />
//           {extended && <p>Settings</p>}
//         </div>
//       </div>

//       <ToastContainer />
//     </div>
//   );
// };

// export default Sidebar;
