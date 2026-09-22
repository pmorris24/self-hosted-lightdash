import React from 'react';
import './ladder.css';

// Every tab has the same two parts: the method for any Lightdash content,
// then the same method for Data Apps.
export function Status({ released, children }) {
  return <span className="ladder-status" data-released={released || undefined}><i/>{children}</span>;
}
export function DataAppsStep({ title, status, children }) {
  return <header className="ladder-step">
    <div><p className="section-kicker">The next step · Data Apps</p><h2>{title}</h2>{status}</div>
    <div className="ladder-step-lead">{children}</div>
  </header>;
}
