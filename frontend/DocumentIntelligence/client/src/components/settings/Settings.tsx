import React from 'react';
// Import the component containing the actual settings UI
import ProfileSettings from './ProfileSettings';

const Settings: React.FC = () => {
  return (
    // Remove the outer padding and title, let ProfileSettings handle layout
    // <div className="p-4 md:p-6 lg:p-8">
    //   <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Settings</h2>
    //   <div className="border border-dashed dark:border-gray-700 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-800/50">
    //     <p className="text-gray-500 dark:text-gray-400">
    //       Settings content will go here. (Placeholder)
    //     </p>
    //   </div>
    // </div>
    // Render the actual settings UI component
    <ProfileSettings />
  );
};

export default Settings; 