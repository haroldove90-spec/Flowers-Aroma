import React, { useState } from 'react';

export const AROMA_FLOWER_LOGO_URL = 'https://daloocomercializadora.com.mx/aromaflowerlogo.png';
export const AROMA_FLOWER_ICON_URL = 'https://daloocomercializadora.com.mx/aromaflowericono.png';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'custom';
  withText?: boolean;
  unencapsulated?: boolean;
  variant?: 'logo' | 'icon';
  alt?: string;
}

export const AromaFlowersLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  withText = false,
  variant = 'logo',
  alt = 'Aroma Flower',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: 'h-6 w-auto max-w-[90px]',
    sm: 'h-8 sm:h-9 w-auto max-w-[120px]',
    md: 'h-10 sm:h-11 w-auto max-w-[150px]',
    lg: 'h-16 sm:h-20 w-auto max-w-[220px]',
    xl: 'h-24 sm:h-28 w-auto max-w-[300px]',
    hero: 'h-28 sm:h-36 md:h-44 w-auto max-w-[380px]',
    custom: '',
  };

  const primaryUrl = variant === 'icon' ? AROMA_FLOWER_ICON_URL : AROMA_FLOWER_LOGO_URL;
  const fallbackUrl = variant === 'icon' ? '/aromaflowericono.png' : '/aromaflowerlogo.png';
  const currentSrc = imgError ? fallbackUrl : primaryUrl;

  // Unencapsulated image: no frame, no box, no white card enclosing it
  const imageElement = (
    <img
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (!imgError) setImgError(true);
      }}
      className={`object-contain select-none shrink-0 transition-opacity duration-200 ${sizeMap[size]} ${className}`}
      loading="eager"
      decoding="async"
    />
  );

  if (!withText) {
    return imageElement;
  }

  return (
    <div className="flex items-center gap-3">
      {imageElement}
      <div className="flex flex-col text-left">
        <span className="font-extrabold tracking-tight text-[#000000] text-base sm:text-lg leading-tight">
          Aroma <span className="text-[#5C1125]">Flower</span>
        </span>
        <span className="text-[10px] tracking-wider font-bold text-[#535B28] uppercase mt-0.5">
          Invernadero Florícola
        </span>
      </div>
    </div>
  );
};

