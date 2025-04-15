import React, { useState, useContext } from "react";
import "./Sidebar.css";
import { Context } from "../../context/Context";
import MenuIcon from '@mui/icons-material/Menu';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import MessageOutlinedIcon from '@mui/icons-material/MessageOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryIcon from '@mui/icons-material/History';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

const Sidebar = () => {
  const [extended, setExtended] = useState(false);

  const {
    chatSessions,
    currentSessionId,
    startNewChat,
    selectChat,
    theme,
    toggleTheme
  } = useContext(Context);

  const toggleExtended = () => {
    setExtended((prev) => !prev);
  };

  return (
    <div className={`sidebar ${extended ? "extended" : ""}`}>
      <div className="top">
        <MenuIcon
          onClick={toggleExtended}
          className="menu"
        />
        <div onClick={startNewChat} className="new-chat">
          <AddCommentOutlinedIcon />
          <p>New Chat</p>
        </div>
        {extended && (
          <div className="recent">
            <p className="recent-title">Recent Chats</p>
            {Array.isArray(chatSessions) && chatSessions.map((session) => (
              <div
                key={session.id}
                className={`recent-entry ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => selectChat(session.id)}
              >
                <MessageOutlinedIcon />
                <p>{session.title}</p>
              </div>
            ))}
          </div>
        )}
        {!extended && Array.isArray(chatSessions) && chatSessions.length > 0 && (
          <div className="recent collapsed">
            {chatSessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className={`recent-entry ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => selectChat(session.id)}
                title={session.title}
              >
                <MessageOutlinedIcon />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bottom">
        <div className="bottom-item recent-entry">
          <HelpOutlineIcon />
          <p>Help</p>
        </div>
        <div className="bottom-item recent-entry">
          <HistoryIcon />
          <p>Activity</p>
        </div>
        <div className="bottom-item recent-entry theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
          {theme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
          <p>Theme</p>
        </div>
        <div className="bottom-item recent-entry">
          <SettingsOutlinedIcon />
          <p>Settings</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
