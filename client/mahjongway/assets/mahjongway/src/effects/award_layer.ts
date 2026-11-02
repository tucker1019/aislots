interface AwardAnchor {
    worldPosition: { y: number };
    setSiblingIndex(index: number): void;
}
/** 高处先绘制、低处后绘制；复用锚点也必须按这一轮的实际位置重新排序。 */
export function sortAwardLayer(layer: { children: AwardAnchor[] }) {
    layer.children.slice()
        .sort((a, b) => b.worldPosition.y - a.worldPosition.y)
        .forEach((anchor, index) => anchor.setSiblingIndex(index));
}
