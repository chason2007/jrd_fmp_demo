import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, X, Download } from 'lucide-react';

export default function Lightbox({ url, onClose }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      role="button"
      tabIndex={0}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // slate-900 with high opacity
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClose();
        }
      }}
    >
      {/* Top action bar */}
      <button 
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          zIndex: 10000
        }}
        onClick={onClose}
        onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        onFocus={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        onBlur={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        title="Close (Esc)"
      >
        <X size={20} />
      </button>

      <div 
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'grab'
        }}
      >
        <img 
          src={url} 
          alt="Defect detail" 
          style={{
            maxWidth: '90%',
            maxHeight: '80%',
            objectFit: 'contain',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease-out',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            backgroundColor: 'var(--zinc-900)'
          }}
          onClick={e => e.stopPropagation()} // Prevent closing when clicking the image itself
        />
      </div>

      {/* Bottom control bar */}
      <div 
        style={{
          display: 'flex',
          gap: '1rem',
          backgroundColor: 'rgba(30, 41, 59, 0.8)', // slate-800
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          marginBottom: '2rem',
          zIndex: 10000
        }}
        onClick={e => e.stopPropagation()} // Prevent click propagation
      >
        <button 
          onClick={handleZoomIn} 
          style={{ background: 'none', border: 'none', color: 'var(--zinc-200)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <button 
          onClick={handleZoomOut} 
          style={{ background: 'none', border: 'none', color: 'var(--zinc-200)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
        <button 
          onClick={handleRotate} 
          style={{ background: 'none', border: 'none', color: 'var(--zinc-200)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
          title="Rotate 90°"
        >
          <RotateCw size={20} />
        </button>
        <button 
          onClick={handleDownload} 
          style={{ background: 'none', border: 'none', color: 'var(--zinc-200)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
          title="Download Image"
        >
          <Download size={20} />
        </button>
      </div>
    </div>
  );
}
