import React, { useEffect, useState } from 'react';

// One download of the released SDK, shared by every example that renders it.
let pending;
export function useSdk() {
  const [state, setState] = useState({ sdk: null, error: '' });
  useEffect(() => {
    let alive = true;
    pending ||= import('/sdk-dashboard.js');
    pending.then(sdk => { if (alive) setState({ sdk, error: '' }); })
      .catch(() => { pending = undefined; if (alive) setState({ sdk: null, error: 'The React SDK bundle did not load.' }); });
    return () => { alive = false; };
  }, []);
  return state;
}
export const sdkStyles = { backgroundColor: 'transparent', fontFamily: 'Inter, sans-serif' };
export class SdkBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error
      ? <p className="notice error" role="alert">{this.props.label || 'This example'} failed to render: {String(this.state.error.message || this.state.error)}</p>
      : this.props.children;
  }
}
