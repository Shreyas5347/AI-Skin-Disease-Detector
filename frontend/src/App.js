import { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';
import DermalensMark from './components/DermalensMark';
import CameraCapture from './components/CameraCapture';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const SEVERITY_CLASS = {
  Critical: 'critical',
  High:     'high',
  Moderate: 'moderate',
  Low:      'low',
};
const SEVERITY_STYLE = {
  Critical: { bg: '#fff1f2', border: '#fda4af', badge: '#e11d48', text: '#9f1239' },
  High:     { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', text: '#9a3412' },
  Moderate: { bg: '#fefce8', border: '#fde047', badge: '#ca8a04', text: '#854d0e' },
  Low:      { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', text: '#14532d' },
};
export default function App() {
  const [image, setImage]       = useState(null);
  const [preview, setPreview]   = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [imageSource, setImageSource] = useState('');
  // imageSource: 'upload' | 'camera'
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const isImage = file.type
      ? file.type.startsWith('image/')
      : /\.(jpe?g|png|webp|bmp|gif|tiff?|svg|heic|heif|avif)$/i.test(file.name);
    if (!isImage) {
      setError('Please upload a valid image file.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.'); return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setImageSource('upload');
  };
  
  // ── Handle capture from camera ───────────────────────────────────
  const handleCameraCapture = (file, previewUrl) => {
    setImage(file);
    setPreview(previewUrl);
    setResult(null); setError(null);
    setShowCamera(false);
    setImageSource('camera');
  };
  const handleAnalyze = async () => {
    if (!image || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('file', image);
    try {
      const res = await axios.post(`${API_URL}/predict`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setResult(res.data);
    } catch (err) {
      if (err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'object' && detail !== null) {
          if (Array.isArray(detail.issues) && detail.issues.length > 0) {
            setError(detail.issues.join(' '));
          } else {
            setError(detail.message || 'Image quality check failed.');
          }
        } else {
          setError(detail || 'Server error. Please try again.');
        }
      }
      else if (err.code === 'ECONNABORTED')
        setError('Request timed out. Server may be starting up — wait 30 s and retry.');
      else
        setError('Cannot connect to server. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setImageSource('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const sevClass = result
    ? (SEVERITY_CLASS[result.severity] || 'low')
    : '';

  return (
    <div className="app">
       {/* Camera modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          {/* Logo */}
          <div className="logo">
            <DermalensMark width="42" height="42" style={{ display: 'block', flexShrink: 0 }} />
            <div className="logo-text-wrap">
              <div className="logo-title">Dermalens</div>
              <div className="logo-sub">Screening Companion</div>
            </div>
          </div>

          {/* Right side */}
          <div className="header-right">
            <div className="status-badge">
              <span className="status-dot" />
              Service online
            </div>
            <div className="header-divider" />
            <span className="privacy-badge">Private by design</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">

        {/* ── Hero: split layout ── */}
        {!result && (
          <section className="hero anim-rise">

            {/* Left: headline copy */}
            <div className="hero-left">
              <div className="hero-eyebrow">A calmer place to start</div>

              <h1 className="hero-headline">
                Look<br />
                closer.<br />
                <span className="accent-word">Feel<br />clearer.</span>
              </h1>

              <p className="hero-body">
                Dermalens gives you a clear first look at a skin image,
                with context for what to do next. It is a screening
                companion, not a diagnosis.
              </p>

              <div className="hero-features">
                <div className="hero-feature">
                  <span className="feature-check">✓</span>
                  No account needed
                </div>
                <div className="hero-feature">
                  <span className="feature-check">✓</span>
                  Built for a first look
                </div>
                <div className="hero-feature">
                  <span className="feature-check">✓</span>
                  7 skin conditions detected
                </div>
              </div>

              <div className="hero-quote">
                <blockquote>
                  "A useful answer starts with an honest question."
                </blockquote>
                <cite>— The Dermalens approach</cite>
              </div>
            </div>

            {/* Right: upload panel */}
            <div className="hero-right anim-rise-1">

              {/* Model status banner */}
              <div className="model-banner">
                <div className="model-banner-icon">ℹ️</div>
                <div className="model-banner-text">
                  <div className="model-banner-title">Model is ready</div>
                  <div className="model-banner-desc">
                    MobileNetV2 · HAM10000 · 10,015 training images
                  </div>
                </div>
                <div className="model-banner-status">
                  <span className="model-banner-dot" />
                  Ready
                </div>
              </div>

              {/* Upload / Camera Card */}
              <div className="card upload-card">
                <h2 className="card-title">Analyze Skin Image</h2>
                <p className="card-subtitle">
                  Upload a photo or use your camera to capture the skin lesion for AI analysis.
                </p>

                {/* Source toggle buttons */}
                <div className="source-toggle">
                  <button
                    className={`toggle-btn ${imageSource !== 'camera' ? 'active' : ''}`}
                    onClick={() => fileRef.current?.click()}
                  >
                    📁 Upload Image
                  </button>
                  <button
                    className={`toggle-btn ${imageSource === 'camera' ? 'active' : ''}`}
                    onClick={() => setShowCamera(true)}
                  >
                    📷 Use Camera
                  </button>
                </div>
              {/* Drop zone */}
              <div
                id="upload-dropzone"
                className={`upload-panel ${dragOver ? 'dragover' : ''} ${preview ? 'has-preview' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => !preview && fileRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="Uploaded skin image preview" className="preview-img" />
                ) : (
                  <>
                    <div className="upload-icon-wrap anim-breathe">⬆</div>
                    <div className="upload-title">Bring a skin image here</div>
                    <p className="upload-desc">
                      Drop an image or choose one from your device.
                      A well-lit, close-up photo works best.
                    </p>
                    <button
                      id="choose-image-btn"
                      className="upload-cta"
                      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    >
                      Choose image
                    </button>
                  </>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.tif,.heic,.heif,.avif"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
                aria-label="Upload skin image"
              />

              {/* Error notice */}
              {error && !result && (
                <div className="notice-box error" role="alert">
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Screen button */}
              <div className="screen-btn-wrap">
                <button
                  id="screen-btn"
                  className={`btn-screen ${image && !loading ? 'ready' : ''} ${loading ? 'loading' : ''}`}
                  onClick={handleAnalyze}
                  disabled={!image || loading}
                  aria-label="Analyze uploaded skin image"
                >
                  {loading ? (
                    <><span className="spinner" aria-hidden="true" /> Screening image…</>
                  ) : (
                    <>Screen this image →</>
                  )}
                </button>

                {preview && (
                  <button
                    id="clear-btn"
                    className="btn-reset"
                    onClick={handleReset}
                    style={{ alignSelf: 'center' }}
                  >
                    ✕ Clear image
                  </button>
                )}

                <div className="screen-disclaimer">
                  By continuing, you confirm this image does not contain identifying information.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

        {/* ── Results ── */}
        {result && (
          <div className="results-section anim-rise">

            <div className="results-header-row">
              <div className="results-eyebrow">Screening result</div>
              <button id="analyze-another-btn" className="btn-reset" onClick={handleReset}>
                ← Screen another image
              </button>
            </div>

            {/* Main result card */}
            <div className={`result-card severity-${sevClass} anim-rise`}>
              <div className="result-top">
                <div>
                  <h2 className="result-name">{result.predicted_disease}</h2>
                  <span className={`severity-pill ${sevClass}`}>
                    {result.severity} severity
                  </span>
                </div>
                <div className="confidence-block">
                  <div className="confidence-num">{result.confidence}%</div>
                  <div className="confidence-label">Confidence</div>
                </div>
              </div>

              {result.confidence_note && (
                <div className="notice-box warning" style={{ marginBottom: '1rem' }}>
                  <span>⚡</span> {result.confidence_note}
                </div>
              )}

              <p className="result-desc">{result.description}</p>

              <div className="urgency-bar">
                🚨 <strong>Action required:</strong>&nbsp;{result.urgency}
              </div>
            </div>

            {/* Do's & Don'ts */}
            <div className="cards-grid anim-rise-1">
              <div className="info-card dos-card">
                <div className="info-card-label">✅ Do's</div>
                <ul className="advice-list">
                  {result.dos.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
              <div className="info-card donts-card">
                <div className="info-card-label">✗ Don'ts</div>
                <ul className="advice-list">
                  {result.donts.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            </div>

            {/* Specialist + OTC */}
            <div className="cards-grid anim-rise-2">
              <div className="info-card spec-card">
                <div className="info-card-label">👨‍⚕️ Recommended specialist</div>
                <div className="info-value">{result.specialist}</div>
              </div>
              <div className="info-card otc-card">
                <div className="info-card-label">💊 OTC / Self-care</div>
                <div className="info-value">{result.otc_note}</div>
              </div>
            </div>

            {/* Top 3 predictions */}
            <div className="top3-card anim-rise-3">
              <div className="section-label">Top 3 predictions</div>
              <div className="top3-list">
                {result.top3_predictions.map((p, i) => (
                  <div key={i} className="top3-row">
                    <span className="top3-rank">{i + 1}</span>
                    <div className="top3-name-bar">
                      <span className="top3-name">{p.disease}</span>
                      <div className="top3-bar-track">
                        <div
                          className={`top3-bar-fill ${i === 0 ? 'top' : 'other'}`}
                          style={{ width: `${Math.min(p.confidence, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="top3-pct">{p.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Result footer */}
            <div className="result-footer-card">
              {preview && (
                <img src={preview} alt="Your uploaded image" className="result-thumb" />
              )}
              <div className="result-footer-meta">
                <div className="result-filename">{image?.name}</div>
                <div className="result-disclaimer">⚠ {result.disclaimer}</div>
              </div>
              <button
                id="analyze-again-btn"
                className="btn-analyze-again"
                onClick={handleReset}
              >
                + Screen another
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div className="card how-it-works">
            <h3 className="section-title">How It Works</h3>
            <div className="steps-row">
              {[
                { icon: '📤', step: '1', title: 'Upload or Capture', desc: 'Upload a photo from your device or capture directly using your camera' },
                { icon: '🔍', step: '2', title: 'Quality Check',     desc: 'OpenCV checks image sharpness and lighting before AI analysis' },
                { icon: '🤖', step: '3', title: 'AI Analysis',       desc: 'MobileNetV2 trained on 10,015 HAM10000 images classifies the lesion' },
                { icon: '📋', step: '4', title: 'Get Results',       desc: 'Receive disease prediction, confidence score, and medical recommendations' },
              ].map((s) => (
                <div key={s.step} className="step-item">
                  <div className="step-icon">{s.icon}</div>
                  <div className="step-num">Step {s.step}</div>
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              ))}
            </div>
            <div className="disease-tags">
              <div className="disease-tags-label">Detects 7 skin conditions:</div>
              {['Melanoma','Nevus','Basal Cell Carcinoma','Actinic Keratosis',
                'Benign Keratosis','Dermatofibroma','Vascular Lesion'].map(d => (
                <span key={d} className="disease-tag">{d}</span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-left">
            Dermalens · A first look, held with care. &nbsp;·&nbsp;
            Final Year Project — B.Tech IT · KKWIEER, Nashik · 2025–26
          </span>
          <span className="footer-right">
            <span className="footer-dot" />
            Model: MobileNetV2 · HAM10000
          </span>
        </div>
      </footer>

    </div>
  );
}
