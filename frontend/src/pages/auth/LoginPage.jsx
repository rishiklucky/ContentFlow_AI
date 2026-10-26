import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where to redirect after login (default: /dashboard)
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get('error');
    if (err === 'social_failed') {
      setErrorMessage('Google authentication could not be completed. Please try signing in again.');
    } else if (err === 'no_active_session') {
      setErrorMessage('No active Google session found. Please sign in again.');
    } else if (err === 'account_deactivated') {
      setErrorMessage('This account has been deactivated.');
    } else if (err) {
      setErrorMessage(decodeURIComponent(err));
    }
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <div className="p-4 p-sm-5 border hairline-border-dark bg-white shadow-sm">
            {/* Header / Brand */}
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center mb-2"
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--cf-ink-primary)',
                  color: 'var(--cf-surface-canvas)',
                  fontFamily: 'var(--cf-font-mono)',
                  fontWeight: 700,
                  fontSize: '16px',
                }}
              >
                CF
              </div>
              <h1 className="heading-display h3 mb-1">Welcome Back</h1>
              <p className="font-sans text-muted" style={{ fontSize: '13px' }}>
                Sign in to your ContentFlow AI account
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                className="p-3 mb-4 border d-flex align-items-start gap-2 text-danger font-sans"
                style={{
                  backgroundColor: '#FEF2F2',
                  borderColor: '#F87171',
                  fontSize: '13px',
                }}
                role="alert"
              >
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Neon Auth Google Sign In Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  setErrorMessage('');
                  setIsSubmitting(true);
                  await authService.initiateNeonGoogleAuth();
                } catch (err) {
                  setErrorMessage(err.message || 'Google authentication with Neon Auth failed.');
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="cf-btn cf-btn-secondary w-100 touch-target mb-3 d-flex align-items-center justify-content-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>CONTINUE WITH GOOGLE</span>
            </button>

            <div className="d-flex align-items-center my-3">
              <div className="flex-grow-1 hairline-t"></div>
              <span className="px-2 font-mono text-muted text-uppercase" style={{ fontSize: '10px' }}>OR WITH EMAIL</span>
              <div className="flex-grow-1 hairline-t"></div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="cf-label" htmlFor="login-email">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="cf-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="cf-label mb-0" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="position-relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="cf-input pe-5"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none p-2"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ fontSize: '12px' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-100 touch-target mb-3"
                disabled={isSubmitting}
                icon={LogIn}
              >
                {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
              </Button>
            </form>

            {/* Footer link to register */}
            <div className="pt-3 hairline-t text-center font-sans text-muted" style={{ fontSize: '13px' }}>
              Don't have an account yet?{' '}
              <Link to="/register" className="fw-semibold text-dark text-decoration-underline">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
