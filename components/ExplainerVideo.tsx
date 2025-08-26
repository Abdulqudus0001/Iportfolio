import React from 'react';

const ExplainerVideo: React.FC = () => {
  return (
    <div className="relative w-full overflow-hidden" style={{ paddingTop: '56.25%' }}>
      {/* 
        This structure creates a responsive 16:9 container that works universally,
        avoiding issues with specific Tailwind CSS versions or CDN limitations.
        Source: TD Ameritrade - "Portfolio Diversification 101"
        URL: https://www.youtube.com/watch?v=hjh-K_n4z4o
      */}
      <iframe
        src="https://www.youtube.com/embed/hjh-K_n4z4o?rel=0"
        title="iPortfolio Explainer - Portfolio Diversification 101"
        frameBorder="0"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute top-0 left-0 w-full h-full"
      ></iframe>
    </div>
  );
};

export default ExplainerVideo;