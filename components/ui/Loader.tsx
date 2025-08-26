
import React from 'react';

const Loader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-primary"></div>
      <p className="text-light-text-secondary">{message}</p>
    </div>
  );
};

export default Loader;
