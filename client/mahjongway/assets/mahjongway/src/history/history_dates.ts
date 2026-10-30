import { button, el } from './history_dom';
import { dateRange } from './history_model';
export function datePicker(
    host: HTMLElement,
    start: string,
    end: string,
    confirm: (start: string, end: string) => void,
    cancel: () => void,
) {
    const body = el('div', 'history-dates');
    const first = group('开始', start),
        second = group('结束', end);
    const error = el('div', 'history-date-error');
    error.setAttribute('role', 'alert');
    const actions = el('div', 'history-date-actions');
    actions.append(
        button('取消', cancel),
        button(
            '确认',
            () => {
                try {
                    const a = first.value(),
                        b = second.value();
                    dateRange(a, b);
                    confirm(a, b);
                } catch (reason) {
                    error.textContent = reason instanceof Error ? reason.message : '日期无效';
                }
            },
            'confirm',
        ),
    );
    body.append(first.node, second.node, error, actions);
    host.append(body);
}
function group(label: string, date: string) {
    const node = el('div', 'history-date-group');
    node.append(el('div', 'history-date-caption', label));
    const labels = el('div', 'history-date-labels');
    for (const title of ['年', '月', '日']) labels.append(el('span', '', title));
    const fields = el('div', 'history-date-fields');
    const [year, month, day] = date.split('-').map(Number);
    const select = (name: string, values: number[], value: number) => {
        const control = el('select');
        control.setAttribute('aria-label', label + name);
        for (const n of values) {
            const option = el('option', '', String(n).padStart(name === '年' ? 4 : 2, '0'));
            option.value = String(n);
            option.selected = n === value;
            control.append(option);
        }
        fields.append(control);
        return control;
    };
    const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 6 + i);
    if (!years.includes(year)) years.push(year);
    const y = select('年', years.sort(), year),
        m = select(
            '月',
            Array.from({ length: 12 }, (_, i) => i + 1),
            month,
        );
    const days = () => new Date(Number(y.value), Number(m.value), 0).getDate();
    const d = select(
        '日',
        Array.from({ length: days() }, (_, i) => i + 1),
        day,
    );
    const update = () => {
        const old = Number(d.value);
        d.replaceChildren();
        for (let i = 1; i <= days(); i++) {
            const option = el('option', '', String(i).padStart(2, '0'));
            option.value = String(i);
            option.selected = i === Math.min(old, days());
            d.append(option);
        }
    };
    y.addEventListener('change', update);
    m.addEventListener('change', update);
    node.append(labels, fields);
    return {
        node,
        value: () => [y.value, m.value.padStart(2, '0'), d.value.padStart(2, '0')].join('-'),
    };
}
