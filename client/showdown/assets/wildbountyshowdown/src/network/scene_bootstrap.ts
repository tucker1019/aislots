/** Keep gameplay inactive until both session and dynamic assets are ready. */
export async function bootstrapScene(steps: {
    session: () => Promise<unknown>;
    resources: () => Promise<unknown>;
    isAlive: () => boolean;
    ready: () => void;
}): Promise<void> {
    await Promise.all([steps.session(), steps.resources()]);
    if (steps.isAlive()) steps.ready();
}
