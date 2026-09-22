// Built as its own file: the released SDK carries the Lightdash frontend, so
// only the examples that render it pay for it.
import Lightdash from '@lightdash/sdk';

export function SdkDashboard({ instanceUrl, token, theme, filters, styles }) {
  return <Lightdash.Dashboard instanceUrl={instanceUrl} token={token} theme={theme} filters={filters} styles={styles}/>;
}
export function SdkChart({ instanceUrl, token, id, theme, styles }) {
  return <Lightdash.Chart instanceUrl={instanceUrl} token={token} id={id} theme={theme} styles={styles}/>;
}
