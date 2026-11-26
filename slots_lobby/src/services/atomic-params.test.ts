import { beforeEach, describe, expect, it } from 'vitest';
import { appendAtomicParams, getAtomicParams, isAndroidApp } from './atomic-params';

describe('公共原子参数', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('Web 默认生成 app_name=aggame、AGGAMEWEB_版本号，并持久化随机 uuid', () => {
    const first = getAtomicParams();
    const second = getAtomicParams();

    expect(first.app_name).toBe('aggame');
    expect(first.cv).toMatch(/^AGGAMEWEB_\d+\.\d+\.\d+/);
    expect(first.uuid).toBeTruthy();
    expect(first.uuid).toBe(second.uuid);
    expect(localStorage.getItem('aggame_device_uuid')).toBe(first.uuid);
    expect(first.lca_lang).toBeTruthy();
    expect(first.lca_coun).toMatch(/^[A-Z]{2}$/);
    expect(Number(first.client_ts)).toBeGreaterThan(0);
    expect(isAndroidApp()).toBe(false);
  });

  it('链接参数可覆盖 app_name/appname、cv 和 uuid，并在路由切换后保留', () => {
    window.history.replaceState({}, '', '/?appname=aggame&cv=AGGAMEAPK_1.0.0');
    const apkParams = getAtomicParams();

    expect(apkParams.app_name).toBe('aggame');
    expect(apkParams.cv).toBe('AGGAMEAPK_1.0.0');
    expect(apkParams.uuid).toBe(localStorage.getItem('aggame_device_uuid'));
    expect(isAndroidApp()).toBe(true);

    window.history.replaceState({}, '', '/wallet');
    expect(getAtomicParams().cv).toBe('AGGAMEAPK_1.0.0');
    expect(isAndroidApp()).toBe(true);
  });

  it('URL 传入 uuid 时覆盖默认设备 id，且请求链接自动附带原子参数', () => {
    window.history.replaceState({}, '', '/?app_name=custom_app&cv=AGGAMEAPK_2.0.0&uuid=fixed-device-1');
    const url = appendAtomicParams('/api/user/user/info?uid=7');
    const parsed = new URL(url, 'https://aggames.buzz');

    expect(parsed.pathname).toBe('/api/user/user/info');
    expect(parsed.searchParams.get('uid')).toBe('7');
    expect(parsed.searchParams.get('app_name')).toBe('custom_app');
    expect(parsed.searchParams.get('cv')).toBe('AGGAMEAPK_2.0.0');
    expect(parsed.searchParams.get('uuid')).toBe('fixed-device-1');
    expect(parsed.searchParams.get('lca_coun')).toBeTruthy();
    expect(parsed.searchParams.get('lca_lang')).toBeTruthy();
    expect(parsed.searchParams.get('client_ts')).toBeTruthy();
  });
});
