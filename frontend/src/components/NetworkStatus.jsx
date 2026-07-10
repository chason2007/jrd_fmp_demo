import { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.75rem',
      fontWeight: '600',
      padding: '0.25rem 0.6rem',
      borderRadius: '4px',
      backgroundColor: isOnline ? 'var(--ok-bg)' : 'var(--warn-bg)',
      color: isOnline ? 'var(--ok-fg)' : 'var(--warn-fg)',
      border: `1px solid ${isOnline ? 'var(--ok-border)' : 'var(--warn-border)'}`,
      transition: 'all 0.3s ease'
    }} title={isOnline ? 'Internet connection active' : 'Disconnected from internet'}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: isOnline ? 'var(--ok)' : 'var(--warn-solid)'
      }} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}
