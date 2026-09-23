/**
 * The parts of the embedded agent a host page can turn off.
 *
 * Every one defaults to on, so an embed that says nothing gets the agent as
 * the product ships it. A host turns a part off when its own chrome already
 * carries it — a page with its own title bar does not want the agent's — or
 * when the feature is not part of what it is offering its viewers.
 *
 * This is a public contract: a name here is one a customer writes into their
 * code, so add freely and treat the existing ones as frozen.
 */
export type SdkAgentFeatures = {
    /** The panel's title bar: the agent's mark and name. */
    header?: boolean;
    /** The agent's picture above its name. */
    avatar?: boolean;
    /** What the agent is for, under its name. */
    description?: boolean;
    /** The agent's instructions, behind the info icon beside its name. */
    instructions?: boolean;
    /** The agent's tags. */
    tags?: boolean;
    /** How long conversations with this agent are kept. */
    retentionNotice?: boolean;
    /** Connect an external source — GitHub and the rest — before asking. */
    integrations?: boolean;
    /** The charts and dashboards a question carries with it. */
    pinnedContext?: boolean;
    /** The questions the agent offers before the first message. */
    suggestedQuestions?: boolean;
    /** Attaching a file to a question. */
    attachments?: boolean;
};

/** Every part on, which is what the product renders. */
export const DEFAULT_SDK_AGENT_FEATURES: Required<SdkAgentFeatures> = {
    header: true,
    avatar: true,
    description: true,
    instructions: true,
    tags: true,
    retentionNotice: true,
    integrations: true,
    pinnedContext: true,
    suggestedQuestions: true,
    attachments: true,
};

/** The features a surface should render, with anything unsaid left on. */
export const resolveSdkAgentFeatures = (
    features: SdkAgentFeatures | undefined,
): Required<SdkAgentFeatures> => ({
    ...DEFAULT_SDK_AGENT_FEATURES,
    ...features,
});
