import React, { useState } from "react";
import "./Sidebar.css";
import { assets } from "../../assets/assets";

const Sidebar = () => {
  const [extended, setextended] = useState(false);

  return (
    <div className="sidebar">
      <div className="top">
        <img
          onClick={() => setextended((prev) => !prev)}
          className="menu"
          src={assets.menu_icon}
          alt=""
        />
        <div className="new-chat">
          <img src={assets.plus_icon} alt="" />
          {extended ? <p>New Chat</p> : null}
        </div>
        {extended ? (
          <div className="recent">
            <p className="recent_title">Recent</p>
            <div className="recent-entery">
              <img src={assets.message_icon} alt="" />
              <p>What Is React..</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="bottom">
        <div className="bottom_item recent-entery">
          <img src={assets.question_icon} alt="" />
          {extended ? <p>Help</p> : null}
        </div>

        <div className="bottom_item recent-entery">
          <img src={assets.history_icon} alt="" />
          {extended ? <p>Activity</p> : null}
        </div>

        <div className="bottom_item recent-entery">
          <img src={assets.setting_icon} alt="" />
          {extended ? <p>Setting</p> : null}
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
  