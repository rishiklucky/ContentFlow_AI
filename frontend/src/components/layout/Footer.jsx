import React from 'react';

export default function Footer() {
  return (
    <footer className="hairline-t bg-light py-2 px-3 font-mono text-muted d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ fontSize: '10px' }}>
      <div>
        <span>SECURITY ENCLAVE: </span>
        <strong className="text-dark">ISOLATED LOCAL ENVIRONMENT</strong>
      </div>
      <div>
        <span>GROUNDING STANDARD: </span>
        <strong className="text-dark">STRICT FACTUAL CONSISTENCY</strong>
      </div>
      <div className="d-none d-md-block">
        <span>CONTENTFLOW AI &copy; {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
