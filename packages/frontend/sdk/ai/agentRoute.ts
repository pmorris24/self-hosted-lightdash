/**
 * The route the agent believes it is on. It is the embed route, whatever the
 * host page's URL is: the pages read their agent and thread from it, and the
 * embed path is what tells them to leave out the app's chrome.
 */
export const agentRoute = (
    projectUuid: string,
    agentUuid: string,
    threadUuid?: string,
) =>
    threadUuid
        ? `/embed/${projectUuid}/ai-agents/${agentUuid}/threads/${threadUuid}`
        : `/embed/${projectUuid}/ai-agents/${agentUuid}/threads`;
