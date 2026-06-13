import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/api';
import { ShieldCheck, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/auth.css';

const EMAIL_STORAGE_KEY = 'vis_reset_email';
const OTP_STORAGE_KEY = 'vis_reset_otp';

export function VerifyOtpPage({ onContinue, onBack, onMissingEmail }) {
  const showToast = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({ otp: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY) || '';
    if (!storedEmail) {
      onMissingEmail();
      return;
    }
    setEmail(storedEmail);
  }, [onMissingEmail]);

  const validateOtp = (value) => {
    if (!value.trim()) return 'OTP is required';
    if (!/^\d{6}$/.test(value.trim())) return 'OTP must be 6 digits';
    return '';
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const otpError = validateOtp(otp);
    setErrors({ otp: otpError });
    if (otpError) return;

    setIsLoading(true);
    try {
      await authApi.verifyOtp(email, otp.trim());
      localStorage.setItem(OTP_STORAGE_KEY, otp.trim());
      showToast('success', 'OTP verified successfully.');
      onContinue();
    } catch (err) {
      showToast('error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-icon">🛡️</div>
          <h2>Verify OTP</h2>
          <p>Sent to <span style={{ color: '#fff', fontWeight: '700' }}>{email}</span></p>
        </div>

        <div className="auth-body">
          <form onSubmit={handleVerify}>
            <div className="auth-form-group">
              <label className="auth-label">6-Digit OTP</label>
              <div className="auth-input-wrapper">
                <ShieldCheck className="auth-input-icon" size={18} />
                <input
                  type="text"
                  placeholder="000000"
                  className={`auth-input ${errors.otp ? 'error' : ''}`}
                  value={otp}
                  onChange={(event) => {
                    const val = event.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(val);
                    if (errors.otp) setErrors({ otp: '' });
                  }}
                  disabled={isLoading}
                  style={{ letterSpacing: '8px', fontSize: '18px', textAlign: 'center', paddingLeft: '16px' }}
                  autoFocus
                />
              </div>
              {errors.otp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', color: '#EF4444' }}>
                  <AlertCircle size={14} />
                  <span className="auth-error-text" style={{ marginTop: 0 }}>{errors.otp}</span>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="auth-btn-primary" 
              disabled={otp.length !== 6 || isLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              {isLoading ? (
                'Verifying...'
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Verify OTP</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <button 
              onClick={onBack} 
              className="auth-link" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto' }}
              disabled={isLoading}
            >
              <ArrowLeft size={16} />
              <span>Back to Email...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
