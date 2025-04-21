import React, { useState, useContext, useRef, useEffect } from "react";
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

const Sidebar = () => {
  const [extended, setExtended] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const renameInputRef = useRef(null);

  const {
    chatSessions,
    currentSessionId,
    startNewChat,
    selectChat,
    theme,
    toggleTheme,
    deleteChatSession,
    updateChatTitle,
  } = useContext(Context);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const toggleExtended = () => {
    setExtended((prev) => !prev);
    if (!extended) {
      setMenuOpenId(null);
      setRenamingId(null);
    }
  };

  const handleDelete = (sessionId) => {
    deleteChatSession(sessionId);
    setMenuOpenId(null);
  };

  const handleStartRename = (session) => {
    setRenamingId(session.id);
    setNewTitle(session.title);
    setMenuOpenId(null);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setNewTitle("");
  };

  const handleSaveRename = async () => {
    if (renamingId && newTitle.trim() !== "") {
      await updateChatTitle(renamingId, newTitle);
    }
    setRenamingId(null);
    setNewTitle("");
  };

  const handleRenameKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSaveRename();
    } else if (event.key === 'Escape') {
      handleCancelRename();
    }
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
          {extended && <p>New Chat</p>}
        </div>
        {extended && (
          <div className="recent">
            <p className="recent-title">Recent Chats</p>
            {Array.isArray(chatSessions) && chatSessions.map((session) => (
              <div
                key={session.id}
                className={`recent-entry ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => renamingId !== session.id && selectChat(session.id)}
              >
                <MessageOutlinedIcon />
                {renamingId === session.id ? (
                  <div className="rename-container">
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleCancelRename}
                      className="rename-input"
                    />
                    <button onClick={handleSaveRename} className="rename-button save"><CheckIcon fontSize="small" /></button>
                    <button onClick={handleCancelRename} className="rename-button cancel"><CloseIcon fontSize="small" /></button>
                  </div>
                ) : (
                  <p className="recent-entry-title">{session.title}</p>
                )}
                {extended && renamingId !== session.id && (
                  <div className="chat-options">
                    <MoreVertIcon
                      className="more-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === session.id ? null : session.id);
                      }}
                    />
                    {menuOpenId === session.id && (
                      <div className="delete-menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(session);
                          }}
                        >
                          <DriveFileRenameOutlineIcon fontSize="small" /> Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session.id);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
          {extended && <p>Help</p>}
        </div>
        <div className="bottom-item recent-entry">
          <HistoryIcon />
          {extended && <p>Activity</p>}
        </div>
        <div className="bottom-item recent-entry theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
          {theme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
          {extended && <p>Theme</p>}
        </div>
        <div className="bottom-item recent-entry">
          <SettingsOutlinedIcon />
          {extended && <p>Settings</p>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
