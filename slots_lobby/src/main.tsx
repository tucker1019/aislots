import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/games.css';
import { App } from './app/App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
