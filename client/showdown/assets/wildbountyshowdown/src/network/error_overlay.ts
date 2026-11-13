import { showGameDialog } from '../ui/game_dialogs';
import { gameErrorMessage } from '../ui/dialog_message';
/** Retry invokes the same pending operation; neither identity nor wager changes here. */
export function retryRequest(error: unknown, retry: () => void, exit: () => void): () => void {
    const copy=gameErrorMessage(error);
    return showGameDialog({title:copy.title,message:copy.message,variant:copy.funds?'notice':'failure',actions:copy.expired?[{label:'返回大厅',run:exit}]:[{label:'重试',run:retry},{label:'返回大厅',run:exit}]});
}
