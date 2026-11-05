import {expect,it} from 'vitest';
import {viewportMetrics} from './designViewport';
it('scales down from 420 and converts physical height into design height',()=>{
 for(const width of [200,280,320,375,390,420]){const m=viewportMetrics(width,800);expect(m.scale*420).toBeCloseTo(width);expect(m.height*m.scale).toBeCloseTo(800);}
});
it('caps desktop scale at one and never divides by zero',()=>{
 expect(viewportMetrics(1440,900)).toEqual({scale:1,height:900});expect(Number.isFinite(viewportMetrics(0,0).height)).toBe(true);
});
