/** 首次进入且服务端无历史记录时的展示盘面。美术编号，列优先；不参与开奖。
 * 每列：上装饰、半露预览、四张有效牌、下装饰。 */
const INITIAL_STRIPS = [
    [7, 7, 6, 8, 5, 7, 7],
    [3, 3, 2, 1003, 9, 1, 1],
    [8, 8, 10, 8, 5, 10, 7],
    [3, 3, 2, 9, 1004, 1, 7],
    [3, 3, 6, 8, 5, 7, 7],
];
export function initialStrips(): number[][] {
    return INITIAL_STRIPS.map(column => column.slice());
}
