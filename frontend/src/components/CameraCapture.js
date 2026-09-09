/**
 * CameraCapture.js
 * ==================
 * Gives the user a live camera feed and a capture button.
 *
 * How it works:
 *   1. Ask browser for camera permission
 *   2. Show live video feed using <video> element
 *   3. When user clicks Capture:
 *      - Draw current video frame onto a hidden <canvas>
 *      - Convert canvas to a Blob (image file in memory)
 *      - Pass that Blob up to App.js via onCapture() callback
 *   4. Show preview of captured photo
 *   5. User can retake or confirm
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef    = useRef(null);   // the live <video> element
  const canvasRef   = useRef(null);   // hidden canvas for capturing frame
  const streamRef   = useRef(null);   // camera stream (needed to stop it)

  const [phase, setPhase]         = useState('starting');
  // phases: 'starting' | 'live' | 'captured' | 'error'

  const [capturedSrc, setCapturedSrc] = useState(null);  // preview URL
  const [errorMsg, setErrorMsg]       = useState('');
  const [facingMode, setFacingMode]   = useState('environment');
  // 'environment' = back camera, 'user' = front camera

  // ── Start camera ────────────────────────────────────────────────
  const startCamera = useCallback(async (facing) => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setPhase('starting');
    setErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,      // back or front camera
          width:  { ideal: 1280 },
          height: { ideal: 720  },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Attach stream to the <video> element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Ignore AbortError when play() is interrupted by camera stream reload
          if (playErr.name !== 'AbortError') {
            console.warn('Video play error:', playErr);
          }
        }
        setPhase('live');
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMsg(
          'Camera access denied. Please allow camera permission in your browser settings and try again.'
        );
      } else if (err.name === 'NotFoundError') {
        setErrorMsg(
          'No camera found on this device. Please use the upload option instead.'
        );
      } else {
        setErrorMsg(`Camera error: ${err.message}`);
      }
      setPhase('error');
    }
  }, []);

  // Start camera when component mounts
  useEffect(() => {
    startCamera(facingMode);

    // Cleanup: stop camera when component unmounts (user closes camera)
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);   // eslint-disable-line

  // ── Capture photo ────────────────────────────────────────────────
  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Set canvas size to match video
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get preview URL (for showing the captured image)
    const previewUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedSrc(previewUrl);
    setPhase('captured');

    // Stop the camera stream (save battery/resources)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  // ── Confirm capture — convert to File and send up ────────────────
  const confirmCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to Blob (binary image data)
    canvas.toBlob((blob) => {
      if (!blob) return;

      // Create a File object (same as if user uploaded a file)
      const file = new File([blob], 'camera_capture.jpg', {
        type: 'image/jpeg',
      });

      // Send file + preview URL up to App.js
      onCapture(file, capturedSrc);
    }, 'image/jpeg', 0.92);
  };

  // ── Retake — restart camera ──────────────────────────────────────
  const retake = () => {
    setCapturedSrc(null);
    startCamera(facingMode);
  };

  // ── Flip camera (front/back) ─────────────────────────────────────
  const flipCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>📷 Camera Capture</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Starting ── */}
        {phase === 'starting' && (
          <div style={styles.statusBox}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>Starting camera...</p>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div style={styles.errorBox}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📷❌</div>
            <p style={styles.errorText}>{errorMsg}</p>
            <button style={styles.btnSecondary} onClick={onClose}>
              Use Upload Instead
            </button>
          </div>
        )}

        {/* ── Live Camera Feed ── */}
        {(phase === 'live' || phase === 'starting') && (
          <div style={styles.videoWrap}>
            <video
              ref={videoRef}
              style={styles.video}
              autoPlay
              playsInline     // required for iOS
              muted
            />

            {/* Guide overlay */}
            {phase === 'live' && (
              <div style={styles.guideOverlay}>
                <div style={styles.guideFrame} />
                <p style={styles.guideText}>
                  Position the skin lesion inside the frame
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Captured Preview ── */}
        {phase === 'captured' && capturedSrc && (
          <div style={styles.previewWrap}>
            <img src={capturedSrc} alt="Captured" style={styles.previewImg} />
            <p style={styles.previewLabel}>Review your photo</p>
          </div>
        )}

        {/* Hidden canvas — used for capturing frame */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* ── Tips ── */}
        {phase === 'live' && (
          <div style={styles.tipsBox}>
            💡 Tips: Good lighting · Steady hand · Lesion fills the frame · 5–10cm distance
          </div>
        )}

        {/* ── Controls ── */}
        <div style={styles.controls}>
          {/* Live phase controls */}
          {phase === 'live' && (
            <>
              <button style={styles.btnSecondary} onClick={flipCamera}>
                🔄 Flip Camera
              </button>
              <button style={styles.btnCapture} onClick={capturePhoto}>
                📸 Capture
              </button>
              <button style={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
            </>
          )}

          {/* Captured phase controls */}
          {phase === 'captured' && (
            <>
              <button style={styles.btnSecondary} onClick={retake}>
                🔄 Retake
              </button>
              <button style={styles.btnPrimary} onClick={confirmCapture}>
                ✅ Use This Photo
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    width: '100%', maxWidth: '500px',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.25rem',
    background: '#1e3a8a', color: 'white',
  },
  headerTitle: { fontWeight: '700', fontSize: '1rem' },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)', border: 'none',
    color: 'white', width: '28px', height: '28px',
    borderRadius: '50%', cursor: 'pointer', fontSize: '0.85rem',
  },
  videoWrap: { position: 'relative', background: '#000', width: '100%' },
  video: { width: '100%', maxHeight: '360px', display: 'block', objectFit: 'cover' },
  guideOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
    pointerEvents: 'none',
  },
  guideFrame: {
    width: '200px', height: '200px',
    border: '2px solid rgba(255,255,255,0.7)',
    borderRadius: '12px',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
  },
  guideText: {
    color: 'white', fontSize: '0.8rem',
    background: 'rgba(0,0,0,0.5)', padding: '0.3rem 0.75rem',
    borderRadius: '9999px',
  },
  previewWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#000', padding: '0.5rem',
  },
  previewImg: { width: '100%', maxHeight: '360px', objectFit: 'contain' },
  previewLabel: {
    color: 'white', fontSize: '0.8rem',
    padding: '0.5rem', margin: 0,
  },
  tipsBox: {
    background: '#eff6ff', padding: '0.6rem 1rem',
    fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.5,
  },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '3rem', gap: '1rem',
  },
  statusText: { color: '#64748b', fontSize: '0.9rem' },
  errorBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '2rem', gap: '0.75rem', textAlign: 'center',
  },
  errorText: { color: '#dc2626', fontSize: '0.875rem', lineHeight: 1.5 },
  controls: {
    display: 'flex', gap: '0.75rem', padding: '1rem',
    justifyContent: 'center', flexWrap: 'wrap',
  },
  btnCapture: {
    background: '#2563eb', color: 'white',
    border: 'none', borderRadius: '9999px',
    padding: '0.75rem 2rem', fontWeight: '700',
    fontSize: '1rem', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
  },
  btnPrimary: {
    background: '#16a34a', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '0.7rem 1.5rem', fontWeight: '600',
    fontSize: '0.9rem', cursor: 'pointer', flex: 1,
  },
  btnSecondary: {
    background: 'white', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '8px',
    padding: '0.7rem 1.25rem', fontWeight: '600',
    fontSize: '0.9rem', cursor: 'pointer',
  },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};