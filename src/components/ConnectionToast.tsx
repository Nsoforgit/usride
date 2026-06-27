import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ConnectionToastProps {
  status: ConnectionStatus;
}

export const ConnectionToast: React.FC<ConnectionToastProps> = ({ status }) => {
  const [visible, setVisible] = useState(false);
  const [prevStatus, setPrevStatus] = useState<ConnectionStatus>(status);

  // Show toast on any status change; auto-hide after 4s if connected
  useEffect(() => {
    if (status !== prevStatus) {
      setPrevStatus(status);
      setVisible(true);

      if (status === 'connected') {
        const timer = setTimeout(() => setVisible(false), 4000);
        return () => clearTimeout(timer);
      }
    }
    // Always show if not connected
    if (status !== 'connected') {
      setVisible(true);
    }
  }, [status, prevStatus]);

  if (!visible) return null;

  const config = {
    connecting: {
      bg: 'rgba(100, 116, 139, 0.95)',
      border: '#94a3b8',
      icon: <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />,
      text: 'Connecting to live updates…',
    },
    connected: {
      bg: 'rgba(16, 185, 129, 0.95)',
      border: '#34d399',
      icon: <Wifi size={14} />,
      text: '🟢 Live — real-time sync active',
    },
    disconnected: {
      bg: 'rgba(239, 68, 68, 0.95)',
      border: '#f87171',
      icon: <WifiOff size={14} />,
      text: '🔴 Disconnected — reconnecting…',
    },
  }[status];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '999px',
        backgroundColor: config.bg,
        border: `1.5px solid ${config.border}`,
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: '600',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
        animation: 'slideUpFade 0.3s ease-out',
        letterSpacing: '0.01em',
      }}
    >
      {config.icon}
      {config.text}
    </div>
  );
};
