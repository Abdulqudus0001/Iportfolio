import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, onClick, isLoading = false }) => {
  const SkeletonLoader = () => (
    <div className="animate-pulse">
      {title && <div className="h-6 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
  
  return (
    <div className={`bg-light-card dark:bg-dark-card shadow-md rounded-lg p-6 ${className}`} onClick={onClick}>
      {title && !isLoading && <h3 className="text-xl font-semibold text-brand-primary mb-4">{title}</h3>}
      {isLoading ? <SkeletonLoader /> : children}
    </div>
  );
};

export default Card;
