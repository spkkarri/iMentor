// client/src/components/Sidebar.js
import React from 'react';
import './Sidebar.css'; // We will create this CSS file

const Sidebar = ({ currentView, setCurrentView }) => {
  const views = ['Chat', 'Files', 'Analysis', 'History'];
  return (
    <div className="sidebar">
      {views.map(view => (
        <button
          key={view}
          className={`sidebar-button ${currentView === view.toLowerCase() ? 'active' : ''}`}
          onClick={() => setCurrentView(view.toLowerCase())}
          title={view}
        >
          {/* You can replace these with actual icons later */}
          {view.charAt(0)}
        </button>
      ))}
    </div>
  );
};
export default Sidebar;