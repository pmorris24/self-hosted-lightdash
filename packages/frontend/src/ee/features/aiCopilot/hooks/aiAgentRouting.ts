// The agent UI behaves differently when it is embedded: no app chrome, no
// in-app links, no features a viewer without a Lightdash login cannot use.
// The `/embed/` URL says so inside the iframe; the React SDK mounts the same
// pages straight into a host page, where the URL is the customer's, so it
// declares the mode instead.
let embeddedInHostPage = false;

export const setEmbeddedAiAgentMode = (embedded: boolean) => {
    embeddedInHostPage = embedded;
};

export const isEmbedAiAgentRoute = () =>
    embeddedInHostPage ||
    (typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/embed/'));

export const getAiAgentApiBase = (projectUuid: string) =>
    `/projects/${projectUuid}/aiAgents`;

export const getAiAgentPageBase = (projectUuid: string) =>
    isEmbedAiAgentRoute()
        ? `/embed/${projectUuid}/ai-agents`
        : `/projects/${projectUuid}/ai-agents`;
