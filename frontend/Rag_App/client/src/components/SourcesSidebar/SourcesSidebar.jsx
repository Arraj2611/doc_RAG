import React from 'react';
import './SourcesSidebar.css'; // We'll create this next
import CloseIcon from '@mui/icons-material/Close'; // Import close icon

const SourcesSidebar = ({ sources = [], onClose }) => { // Default sources to empty array

    console.log("SourcesSidebar rendering with:", sources); // Debug log

    return (
        <div className="sources-sidebar open"> {/* Add 'open' class for visibility */}
            <button onClick={onClose} className="close-sidebar-btn" aria-label="Close sources">
                <CloseIcon />
            </button>
            <h3>Sources</h3>
            {sources.length === 0 ? (
                <p>No sources available for this response.</p>
            ) : (
                sources.map((source, index) => (
                    <div key={index} className="sidebar-source-item">
                        <h4>{source.name || 'Unknown Source'}</h4>
                        <div className="sidebar-source-meta">
                            {/* Conditionally display page and distance if they exist */}
                            {source.page && <span>{source.page}</span>}
                            {source.distance && <span>{source.distance}</span>}
                        </div>
                        {/* Display the content snippet */}
                        {source.content_snippet && (
                            <div className="sidebar-source-content">
                                <pre>{source.content_snippet}</pre> {/* Use <pre> for better formatting */}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default SourcesSidebar; 