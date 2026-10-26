import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="container py-5 text-center">
      <div className="p-5 border hairline-border bg-white d-inline-block shadow-sm" style={{ maxWidth: '540px' }}>
        <div className="d-flex justify-content-center mb-3">
          <Badge variant="vermilion">CODEX ERROR 404</Badge>
        </div>
        <AlertTriangle size={48} className="text-warning mb-3" />
        <h1 className="heading-display h3 mb-2">Architectural Coordinate Not Found</h1>
        <p className="font-sans text-muted mb-4">
          The requested route does not exist within the ContentFlow workspace or has been moved to an archived codex.
        </p>
        <Button
          variant="primary"
          icon={Home}
          onClick={() => navigate('/')}
        >
          RETURN TO OVERVIEW
        </Button>
      </div>
    </div>
  );
}
