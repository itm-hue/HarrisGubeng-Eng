import React, { useState, useEffect } from 'react';
import { getDirectDriveUrl } from '../lib/imageUtils';

interface SafeImageProps {
  src: string;
  alt?: string;
  className?: string;
  onError?: (e: any) => void;
  [key: string]: any;
}

export default function SafeImage({ src, alt, className, onError, ...props }: SafeImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string>('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  const [loading, setLoading] = useState<boolean>(true);
  const [retryWithDirect, setRetryWithDirect] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setRetryWithDirect(false);

    if (!src) {
      setDisplaySrc('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
      setLoading(false);
      return;
    }

    const directUrl = getDirectDriveUrl(src);

    if (directUrl.startsWith('data:') || directUrl.startsWith('blob:')) {
      setDisplaySrc(directUrl);
      setLoading(false);
      return;
    }

    const isGoogleDomain = 
      directUrl.includes('drive.google.com') ||
      directUrl.includes('docs.google.com') ||
      directUrl.includes('googleusercontent.com');

    if (isGoogleDomain && !directUrl.includes('script.google.com')) {
      setDisplaySrc(directUrl);
      setLoading(false);
      return;
    }

    // Wrap other external and redirect-heavy script.google.com URLs with Google OpenSocial Proxy to bypass CORS, mobile 302 redirect limits
    const proxiedUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(directUrl)}`;
    setDisplaySrc(proxiedUrl);
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!retryWithDirect) {
      // First-stage fail: Fall back to direct URL directly
      setRetryWithDirect(true);
      const directUrl = getDirectDriveUrl(src);
      setDisplaySrc(directUrl);
    } else {
      // Second-stage fail: Show fine-styled Fallback Icon
      setLoading(false);
      e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      if (onError) onError(e);
    }
  };

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={`${className} transition-opacity duration-200 ${loading ? 'opacity-40 animate-pulse' : 'opacity-100'}`}
      onLoad={handleLoad}
      onError={handleImageError}
      {...props}
    />
  );
}
