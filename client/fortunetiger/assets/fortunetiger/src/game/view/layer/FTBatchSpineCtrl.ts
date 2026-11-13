import { _decorator, Component, Node, sp } from 'cc';

const { ccclass, property } = _decorator;

let indexCount = 0;

@ccclass('FTBatchSpineCtrl')

export class FTBatchSpineCtrl extends Component {

    start() {

        //@ts-ignore

        sp.Skeleton.prototype._render = function(batcher: any) {

            if (this._renderData && this._drawList) {

                const rd = this._renderData;

                const chunk = rd.chunk;

                const accessor = chunk.vertexAccessor;

                const meshBuffer = rd.getMeshBuffer()!;

                const origin = meshBuffer.indexOffset;

                indexCount = 0;

                // Fill index buffer

                accessor.appendIndices(chunk.bufferId, rd.indices!);

                for (let i = 0; i < this._drawList.length; i++) {

                    const dc = this._drawList.data[i];

                    if (dc.texture) {

                        indexCount += dc.indexCount;

                    }

                }

                if (this._drawList.length > 0){

                    this._drawIdx = this._drawList.length - 1;

                    const dc = this._drawList.data[0];

                    if (dc.texture){

                        const ib = meshBuffer.requireFreeIA(batcher.device);

                        ib.firstIndex = origin;

                        ib.indexCount = indexCount;

                        batcher.commitIA(this, ib, dc.texture, dc.material!, this.node);

                    }

                }


            }

        }

    }

   

}