import React, { useState } from 'react';
import { useUSRide } from '../context/USRideContext';
import { CheckCircle, AlertTriangle, XCircle, Info, ShieldAlert } from 'lucide-react';

export const CustomModal: React.FC = () => {
  const { modalConfig, hideModal } = useUSRide();
  const [inputText, setInputText] = useState('');

  if (!modalConfig) return null;

  const { title, message, type, onConfirm, onCancel, inputPlaceholder, onInputSubmit } = modalConfig;

  // Icon mapping based on notification type
  const renderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={36} style={{ color: '#10b981' }} />;
      case 'warning':
        return <AlertTriangle size={36} style={{ color: '#f59e0b' }} />;
      case 'error':
        return <XCircle size={36} style={{ color: '#ef4444' }} />;
      case 'security':
        return <ShieldAlert size={36} style={{ color: '#ef4444' }} />;
      default:
        return <Info size={36} style={{ color: '#3b82f6' }} />;
    }
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    hideModal();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    hideModal();
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onInputSubmit) {
      onInputSubmit(inputText);
    }
    setInputText('');
    hideModal();
  };

  // Accent color mapping for buttons
  const getThemeClass = () => {
    switch (type) {
      case 'success':
        return { btn: 'primary-btn', border: '3px solid #10b981' };
      case 'warning':
        return { btn: 'gold-btn', border: '3px solid #f59e0b' };
      case 'error':
      case 'security':
        return { btn: 'danger-btn', border: '3px solid #ef4444' };
      default:
        return { btn: 'primary-btn', border: '3px solid #3b82f6' };
    }
  };

  const theme = getThemeClass();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        borderTop: theme.border,
        color: '#1e293b',
        animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {renderIcon()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0f172a' }}>{title}</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line' }}>{message}</p>
        </div>

        {/* Render Input Prompt Form if inputPlaceholder is present */}
        {inputPlaceholder && onInputSubmit ? (
          <form onSubmit={handleInputSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              className="landmark-select-item"
              style={{
                width: '100%',
                height: '80px',
                padding: '10px',
                fontSize: '12px',
                color: '#1e293b',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                resize: 'none'
              }}
              placeholder={inputPlaceholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                className="sim-btn"
                style={{ flex: 1, padding: '10px', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={theme.btn}
                style={{ flex: 1, padding: '10px', margin: 0, cursor: 'pointer' }}
              >
                Submit
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', marginTop: '4px' }}>
            {onConfirm || onCancel ? (
              <>
                <button
                  type="button"
                  className="sim-btn"
                  style={{ flex: 1, padding: '10px', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={theme.btn}
                  style={{ flex: 1, padding: '10px', margin: 0, cursor: 'pointer' }}
                  onClick={handleConfirm}
                >
                  Confirm
                </button>
              </>
            ) : (
              <button
                type="button"
                className={theme.btn}
                style={{ width: '120px', padding: '10px 0', margin: 0, cursor: 'pointer' }}
                onClick={handleConfirm}
              >
                OK
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
