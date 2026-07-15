/**
 * SplashScreen.tsx
 *
 * A premium, animated intro splash screen inspired by 21st.dev / hover.dev motion styles.
 * It uses Framer Motion for high-fidelity animations:
 *   - Spring-bounced squircle logo entrance
 *   - Expanding radial solar energy rings
 *   - Rotating solar flare particles
 *   - Cycling green tech loading text indicators
 *
 * Plays for ~3.2 seconds and exits smoothly.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

const LOADING_STEPS = [
  'Syncing UNIBEN campus grid...',
  'Connecting live dispatch...',
  'USRide is ready!'
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  // Cycle loading status text
  useEffect(() => {
    const textInterval = setInterval(() => {
      setStepIndex((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 500);

    // Auto-complete splash screen after 1.8s (was 3.2s — too slow on iOS)
    const timeout = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearInterval(textInterval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        scale: 1.05,
        filter: 'blur(8px)',
        transition: { duration: 0.6, ease: 'easeInOut' }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1e1b4b 0%, #0f0c29 60%, #03001e 100%)',
        color: 'white',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* ── Background solar energy rings (Expanding ripples) ── */}
      {[1, 2, 3].map((ring, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 0.4, 0],
            scale: [0.8, 2.5],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: idx * 0.6,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: '280px',
            height: '280px',
            border: '2px solid rgba(245, 158, 11, 0.15)', // UNIBEN gold glow
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ── Solar rotating particle orbit ── */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          pointerEvents: 'none'
        }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: i % 2 === 0 ? '#10b981' : '#f59e0b', // Alternate green & gold
              boxShadow: '0 0 10px currentColor',
              transform: `rotate(${i * 60}deg) translate(150px) rotate(-${i * 60}deg)`,
            }}
          />
        ))}
      </motion.div>

      {/* ── Central app logo card container (Spring bounce) ── */}
      <motion.div
        initial={{ scale: 0.1, opacity: 0, y: 50 }}
        animate={{ 
          scale: 1, 
          opacity: 1, 
          y: 0,
          boxShadow: [
            '0 4px 20px rgba(124, 58, 237, 0.2)',
            '0 20px 40px rgba(124, 58, 237, 0.5)',
            '0 4px 20px rgba(124, 58, 237, 0.2)'
          ]
        }}
        transition={{
          scale: { type: 'spring', damping: 10, stiffness: 80, delay: 0.1 },
          opacity: { duration: 0.4, delay: 0.1 },
          y: { type: 'spring', damping: 10, stiffness: 80, delay: 0.1 },
          boxShadow: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'relative',
          width: '160px',
          height: '160px',
          borderRadius: '36px',
          background: 'linear-gradient(135deg, #1e1b4b, #2e1065)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(255, 255, 255, 0.12)',
          cursor: 'grab'
        }}
      >
        <img 
          src="/logo.png" 
          alt="USRide Logo" 
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '32px',
            objectFit: 'cover',
            pointerEvents: 'none' // Prevent dragging image ghosting
          }}
        />
        
        {/* Glowing battery / solar charge status bubble */}
        <motion.div
          animate={{ scale: [0.9, 1.1, 0.9] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: '-10px',
            right: '-10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            borderRadius: '12px',
            padding: '4px 8px',
            fontSize: '9px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            border: '2px solid #0f0c29',
            boxShadow: '0 4px 10px rgba(16,185,129,0.4)'
          }}
        >
          ⚡ 100%
        </motion.div>
      </motion.div>

      {/* ── Brand Name ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{
          marginTop: '32px',
          textAlign: 'center'
        }}
      >
        <h1 style={{
          fontSize: '24px',
          fontWeight: '900',
          letterSpacing: '1px',
          margin: 0,
          background: 'linear-gradient(to right, #ffffff, #e9d5ff, #fde68a)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          UNIBEN RIDE
        </h1>
        <p style={{
          fontSize: '11px',
          color: '#9ca3af',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginTop: '4px',
          fontWeight: '600'
        }}>
          Clean energy dispatcher
        </p>
      </motion.div>

      {/* ── Loader & Step Text at Bottom ── */}
      <div style={{
        position: 'absolute',
        bottom: '48px',
        width: '100%',
        maxWidth: '280px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Infinite battery fill loader */}
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #5b21b6, #7c3aed, #f59e0b, #10b981)',
              borderRadius: '2px'
            }}
          />
        </div>

        {/* Live step text */}
        <AnimatePresence mode="wait">
          <motion.span
            key={stepIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textAlign: 'center',
              fontWeight: '500'
            }}
          >
            {LOADING_STEPS[stepIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
