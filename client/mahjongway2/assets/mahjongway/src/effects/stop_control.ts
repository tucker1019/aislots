interface StopArtwork {
    getChildByPath(path: string): { active: boolean } | null;
}
/** 复用原生灰色图，不对整颗按钮做灰度处理。 */
export function setStopArtwork(root: StopArtwork, stopped: boolean) {
    const blur = root.getChildByPath('sb_arrow_blur');
    const grey = root.getChildByPath('sb_arrow_grey');
    if (blur) blur.active = !stopped;
    if (grey) grey.active = stopped;
}
