import { Simulator, type SimulationRequest, type SimulationMessage } from '../domain/simulation';

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SimulationRequest>) => void) | null;
  postMessage(message: SimulationMessage): void;
};
worker.onmessage = ({ data }) => {
  const started = performance.now();
  let simulation: Simulator;
  try { simulation = new Simulator(data); }
  catch (error) { worker.postMessage({ type: 'error', message: (error as Error).message }); return; }
  let lastReport = -Infinity;
  function tick() {
    try {
      const deadline = performance.now() + 25;
      do { simulation.step(4096); } while (!simulation.done && performance.now() < deadline);
      const now = performance.now();
      if (simulation.done || now - lastReport >= 150) {
        worker.postMessage({ type: 'progress', progress: { stats: { ...simulation.stats }, elapsedMs: now - started, done: simulation.done } });
        lastReport = now;
      }
      if (!simulation.done) setTimeout(tick, 0);
    } catch (error) { worker.postMessage({ type: 'error', message: (error as Error).message }); }
  }
  tick();
};
