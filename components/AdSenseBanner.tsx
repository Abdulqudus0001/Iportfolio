import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdSenseBannerProps {
  'data-ad-client': string;
  'data-ad-slot': string;
  'data-ad-format'?: 'auto' | 'fluid' | 'display';
  'data-full-width-responsive'?: 'true' | 'false';
  className?: string;
  style?: React.CSSProperties;
}

const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  'data-ad-client': dataAdClient,
  'data-ad-slot': dataAdSlot,
  'data-ad-format': dataAdFormat = 'auto',
  'data-full-width-responsive': dataFullWidthResponsive = 'true',
  className = '',
  style = { display: 'block' }
}) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  return (
    <div className={`text-center my-4 ${className}`}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={dataAdClient}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive}
      ></ins>
    </div>
  );
};

export default AdSenseBanner;