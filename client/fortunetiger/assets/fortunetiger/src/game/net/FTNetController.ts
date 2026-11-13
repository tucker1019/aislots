
import { DefArrayBufferProtocol } from "../../ftframe/network/FTNetInterface";
import { FTNetManager } from "../../ftframe/network/FTNetManager";
import { FTNetNode } from "../../ftframe/network/FTNetNode";
import { FTWebSock } from "../../ftframe/network/FTWebSock";
import { FTGlobal } from "../view/layer/FTGlobal";
import FTSendManager from "./FTSendManager";




export default class {
    private static _netNode: FTNetNode = null;
    static get netNode() {
        if (this._netNode == null) {
            let Node = new FTNetNode();

            Node.init(new FTWebSock(), new DefArrayBufferProtocol(), (checkedFunc: VoidFunction) => {
                FTSendManager.ins.sendLogin(FTGlobal.USER.uid, FTGlobal.USER.accessToken);
                checkedFunc && checkedFunc()
            });

            FTNetManager.getInstance().setNetNode(Node);
            this._netNode = Node
        }
        return this._netNode;
    }

    static closeNet() {
        
        this._netNode&& this._netNode.destroySocket();
        this._netNode = null;
    }
}
