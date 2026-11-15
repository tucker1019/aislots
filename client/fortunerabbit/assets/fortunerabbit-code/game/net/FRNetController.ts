
import { DefArrayBufferProtocol } from "../../frframe/network/FRNetInterface";
import { FRNetManager } from "../../frframe/network/FRNetManager";
import { FRNetNode } from "../../frframe/network/FRNetNode";
import { FRWebSock } from "../../frframe/network/FRWebSock";
import { FRGlobal } from "../view/layer/FRGlobal";
import FRSendManager from "./FRSendManager";




export default class {
    private static _netNode: FRNetNode = null;
    static get netNode() {
        if (this._netNode == null) {
            let Node = new FRNetNode();

            Node.init(new FRWebSock(), new DefArrayBufferProtocol(), (checkedFunc: VoidFunction) => {
                FRSendManager.ins.sendLogin(FRGlobal.USER.uid, FRGlobal.USER.accessToken);
                checkedFunc && checkedFunc()
            });

            FRNetManager.getInstance().setNetNode(Node);
            this._netNode = Node
        }
        return this._netNode;
    }

    static closeNet() {
        
        this._netNode&& this._netNode.destroySocket();
        this._netNode = null;
    }
}
