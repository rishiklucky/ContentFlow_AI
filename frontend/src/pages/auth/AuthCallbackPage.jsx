import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';
import Button from '../../components/common/Button';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('token');
        const urlError = searchParams.get('error');

        if (urlError) {
          throw new Error(decodeURIComponent(urlError));
        }

        const notifyAndRedirect = (authToken) => {
          localStorage.setItem('cf_auth_token', authToken);
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: authToken }, '*');
              window.close();
              return;
            } catch {
              // In case opener is blocked, proceed with standard redirect
            }
          }
          window.location.href = '/dashboard';
        };

        // Path 1: Server-side redirect provided token directly
        if (token) {
          notifyAndRedirect(token);
          return;
        }

        // Path 2: Direct session verification with backend
        try {
          const verifiedData = await authService.verifyNeonSession();
          if (verifiedData && verifiedData.access_token) {
            notifyAndRedirect(verifiedData.access_token);
            return;
          }
        } catch (verifyErr) {
          // If direct verification failed, try client session fallback
        }

        // Path 3: Client session fallback
        const sessionData = await authService.getNeonSession();
        if (sessionData && sessionData.user) {
          const backendData = await authService.socialLogin({
            email: sessionData.user.email,
            full_name: sessionData.user.name,
            provider: 'google',
            provider_account_id: sessionData.user.id,
          });

          notifyAndRedirect(backendData.access_token);
          return;
        }

        throw new Error('Could not find active Google session. Please sign in again.');
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to complete Google authentication. Please try again.');
        }
      }
    }

    handleAuthCallback();

    return () => { isMounted = false; };
  }, [navigate]);

  return (
    <div className="container py-5 text-center">
      <div className="p-4 p-sm-5 border hairline-border bg-white d-inline-block shadow-sm" style={{ maxWidth: '440px', width: '100%' }}>
        {error ? (
          <div>
            <div className="text-danger mb-3">
              <AlertCircle size={40} className="mx-auto" />
            </div>
            <h2 className="heading-display h4 mb-2">Authentication Error</h2>
            <p className="font-sans text-muted mb-4" style={{ fontSize: '13px' }}>
              {error}
            </p>
            <Button variant="primary" onClick={() => navigate('/login')}>
              BACK TO SIGN IN
            </Button>
          </div>
        ) : (
          <div className="py-3 font-mono">
            <div className="spinner-border text-dark mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h2 className="heading-display h5 mb-2">Authenticating with Google</h2>
            <div className="text-muted text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
              VERIFYING CREDENTIALS WITH GOOGLE OAUTH...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
