/**
 * The parts of the embedded agent a host page can turn off.
 *
 * This is a public contract: a name here is one a customer writes into their
 * code, so add freely and treat the existing ones as frozen.
 */

/**
 * `auto` lets the server decide: the capability it reports and the viewer's
 * permission control the feature. `true` asks for it and `false` hides it.
 *
 * A host can hide a feature the server allows. A host cannot turn on a
 * feature the server denies.
 */
export type AiAgentFeatureSetting = 'auto' | boolean;

/**
 * Every part of the agent a host can speak about. Anything left unsaid is
 * `auto`.
 */
export type AiAgentFeatures = {
    /** The panel's title bar: the agent's mark and name. */
    header?: AiAgentFeatureSetting;
    /** The agent's picture above its name. */
    avatar?: AiAgentFeatureSetting;
    /** What the agent is for, under its name. */
    description?: AiAgentFeatureSetting;
    /** The agent's instructions, behind the info icon beside its name. */
    instructions?: AiAgentFeatureSetting;
    /** The agent's tags. */
    tags?: AiAgentFeatureSetting;
    /** Connect an external source before asking. */
    integrations?: AiAgentFeatureSetting;
    /** The charts and dashboards a question carries with it. */
    pinnedContext?: AiAgentFeatureSetting;
    /** The questions the agent offers before the first message. */
    suggestedQuestions?: AiAgentFeatureSetting;
    /** Attaching a file to a question. */
    attachments?: AiAgentFeatureSetting;
    /** How long conversations with this agent are kept. */
    retentionNotice?: AiAgentFeatureSetting;
    /** The list of recent threads beside the conversation. */
    threadNavigation?: AiAgentFeatureSetting;
    /** Pin, rename and delete on a thread. */
    threadActions?: AiAgentFeatureSetting;
    /** What the agent remembers about this viewer. */
    memories?: AiAgentFeatureSetting;
    /** The agent's own settings screen. */
    settings?: AiAgentFeatureSetting;
    /** Sharing a thread with someone else. */
    sharing?: AiAgentFeatureSetting;
    /** Switching between the agents a viewer can reach. */
    agentPicker?: AiAgentFeatureSetting;
    /** Choosing the model that answers. */
    modelPicker?: AiAgentFeatureSetting;
    /** Choosing how much the model reasons. */
    reasoningPicker?: AiAgentFeatureSetting;
    /** Asking in SQL rather than in words. */
    sqlRunner?: AiAgentFeatureSetting;
    /** The longer research run, rather than one answer. */
    deepResearch?: AiAgentFeatureSetting;
    /** The steps under "How this chart was built". */
    toolSteps?: AiAgentFeatureSetting;
    /** The chart an answer produces, opened from the answer. */
    artifacts?: AiAgentFeatureSetting;
    /** Upvote and downvote on an answer. */
    feedback?: AiAgentFeatureSetting;
    /** Adding a message to an evaluation set. */
    evaluation?: AiAgentFeatureSetting;
    /** The debug information behind an answer. */
    debug?: AiAgentFeatureSetting;
    /** The questions the agent offers after it has answered. */
    followUpSuggestions?: AiAgentFeatureSetting;
};

export type AiAgentFeatureName = keyof AiAgentFeatures;

export type ResolvedAiAgentFeatures = Required<
    Record<AiAgentFeatureName, boolean>
>;

/**
 * What `auto` means while the server reports no capability for a feature.
 *
 * A part the embedded agent already draws stays on, so an embed that says
 * nothing keeps what it has today. A part the server guards stays off until
 * the token carries a right for it and the capability response can say so;
 * turning one on here would only render a control the server rejects.
 */
export const AI_AGENT_FEATURE_AUTO: ResolvedAiAgentFeatures = {
    header: true,
    avatar: true,
    description: true,
    instructions: true,
    tags: true,
    integrations: true,
    pinnedContext: true,
    suggestedQuestions: true,
    attachments: true,
    retentionNotice: true,
    modelPicker: true,
    reasoningPicker: true,
    toolSteps: true,
    artifacts: true,
    feedback: true,
    followUpSuggestions: true,
    // Guarded, or not yet built. See the delivery order in the parity spec.
    threadNavigation: false,
    threadActions: false,
    memories: false,
    settings: false,
    sharing: false,
    agentPicker: false,
    sqlRunner: false,
    deepResearch: false,
    evaluation: false,
    debug: false,
};

/**
 * The features the server has to allow before they can render at all.
 *
 * A host asking for one of these is not enough: the token has to carry the
 * right and the capability response has to say yes. Until then the control
 * would only produce an authorization error, so it stays off. The two at the
 * end are not guarded, they are simply not built yet, and the safe behaviour
 * is the same.
 */
export const AI_AGENT_SERVER_GATED: ReadonlySet<AiAgentFeatureName> = new Set([
    'sqlRunner',
    'deepResearch',
    'memories',
    'settings',
    'sharing',
    'agentPicker',
    'evaluation',
    'debug',
    'threadNavigation',
    'threadActions',
]);

/**
 * The features a surface should render.
 *
 * `capabilities` is what the server says this token and viewer may reach.
 * It is the ceiling: a host asking for a denied feature does not get it, and
 * a server-gated feature needs an explicit yes rather than a host's word.
 * Until that response exists, callers pass nothing, every `auto` falls back
 * to what the agent renders today, and every gated feature stays off.
 */
export const resolveAiAgentFeatures = (
    features: AiAgentFeatures | undefined,
    capabilities?: Partial<Record<AiAgentFeatureName, boolean>>,
): ResolvedAiAgentFeatures => {
    const available = (name: AiAgentFeatureName): boolean => {
        const allowed = capabilities?.[name];
        const asked = features?.[name] ?? 'auto';
        // The server denies it, or the host hides it. Either one ends it.
        if (allowed === false || asked === false) return false;
        // A guarded feature needs the server's yes, not the host's.
        if (AI_AGENT_SERVER_GATED.has(name)) return allowed === true;
        // Otherwise the host's word stands, and `auto` asks the server first.
        if (asked === 'auto') return allowed ?? AI_AGENT_FEATURE_AUTO[name];
        return asked;
    };

    const names = Object.keys(AI_AGENT_FEATURE_AUTO) as AiAgentFeatureName[];
    return names.reduce(
        (resolved, name) => ({ ...resolved, [name]: available(name) }),
        {} as ResolvedAiAgentFeatures,
    );
};

/**
 * The parts the product's embedded agent reads today. The rest of the
 * resolved features are a contract the product has still to consume.
 */
export type SdkAgentFeatures = {
    header?: boolean;
    avatar?: boolean;
    description?: boolean;
    instructions?: boolean;
    tags?: boolean;
    retentionNotice?: boolean;
    integrations?: boolean;
    pinnedContext?: boolean;
    suggestedQuestions?: boolean;
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

/** The ten the product reads, taken from the full resolved set. */
export const toSdkAgentFeatures = (
    resolved: ResolvedAiAgentFeatures,
): Required<SdkAgentFeatures> => ({
    header: resolved.header,
    avatar: resolved.avatar,
    description: resolved.description,
    instructions: resolved.instructions,
    tags: resolved.tags,
    retentionNotice: resolved.retentionNotice,
    integrations: resolved.integrations,
    pinnedContext: resolved.pinnedContext,
    suggestedQuestions: resolved.suggestedQuestions,
    attachments: resolved.attachments,
});
