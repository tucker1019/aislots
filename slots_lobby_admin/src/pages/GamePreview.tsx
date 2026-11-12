import { useRef, useState } from 'react';
import { Alert, Card, Form, Input, Select } from 'antd';
import { AsyncButton } from '../components/AsyncButton';
import { Page } from '../components/Page';
import { issuePreviewTicket, type PreviewGameId } from '../services/gamePreview';

interface PreviewFields {
 gameId: PreviewGameId;
 uid: string;
 sid: string;
 previewUrl: string;
}

export function GamePreview() {
 const [form] = Form.useForm<PreviewFields>();
 const submitting = useRef(false);
 const [pending, setPending] = useState(false);
 const [error, setError] = useState('');

 async function openPreview(fields: PreviewFields) {
  if (submitting.current) return;
  const uid = Number(fields.uid.trim());
  const sid = fields.sid.trim();
  const preview = URL.canParse(fields.previewUrl) ? new URL(fields.previewUrl) : null;
  if (!/^\d+$/.test(fields.uid.trim()) || !Number.isSafeInteger(uid) || uid <= 0 || !sid) {
   setError('请输入有效的 UID 和 SID。');
   return;
  }
  if (!preview || !['http:', 'https:'].includes(preview.protocol) ||
      !['localhost', '127.0.0.1'].includes(preview.hostname) ||
      preview.username || preview.password || preview.search || preview.hash) {
   setError('请输入本机 Cocos 预览地址，例如 http://localhost:7456/，地址无需附带参数。');
   return;
  }
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
   setError('浏览器拦截了新窗口，请允许弹出窗口后重试。');
   return;
  }
  tab.opener = null;
  submitting.current = true;
  setPending(true);
  setError('');
  try {
   const ticket = await issuePreviewTicket(uid, sid, fields.gameId);
   if (tab.closed) throw new Error('预览窗口已关闭，请重新打开。');
   const localAdmin = ['localhost', '127.0.0.1'].includes(window.location.hostname);
   preview.searchParams.set('api', localAdmin ? 'http://127.0.0.1:8080' : window.location.origin);
   preview.searchParams.set('launchTicket', ticket);
   tab.location.replace(preview.href);
   form.resetFields(['sid']);
  } catch (cause) {
   tab.close();
   setError(cause instanceof Error ? cause.message : '签发票据失败，请重试。');
  } finally {
   submitting.current = false;
   setPending(false);
  }
 }

 return <Page eyebrow="GAME PREVIEW" title="Cocos 调试" description="启动 Cocos 浏览器预览后，使用当前环境的大厅会话打开本机预览。选择游戏后签发对应游戏的票据。">
  <Card>
   <Form form={form} layout="vertical" initialValues={{ gameId: 'AG1', previewUrl: 'http://localhost:7456/' }} onFinish={openPreview}>
    <Form.Item label="游戏" name="gameId" rules={[{ required: true, message: '请选择游戏' }]}>
     <Select disabled={pending} options={[{ value: 'AG1', label: 'AG1' }, { value: 'AG2', label: 'AG2' }, { value: 'AG3', label: 'AG3' }]} />
    </Form.Item>
    <Form.Item label="平台 UID" name="uid" rules={[{ required: true, message: '请输入平台 UID' }]}>
     <Input inputMode="numeric" disabled={pending} />
    </Form.Item>
    <Form.Item label="平台 SID" name="sid" rules={[{ required: true, message: '请输入平台 SID' }]}>
     <Input.Password autoComplete="off" disabled={pending} />
    </Form.Item>
    <Form.Item label="Cocos 预览地址" name="previewUrl" rules={[{ required: true, message: '请输入预览地址' }]}>
     <Input disabled={pending} />
    </Form.Item>
    {error && <Form.Item><Alert type="error" showIcon title={error} /></Form.Item>}
    <AsyncButton type="primary" htmlType="submit" loading={pending}>签发票据并打开预览</AsyncButton>
   </Form>
  </Card>
 </Page>;
}
