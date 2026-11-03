import { WalletManagement } from '../features/account/WalletManagement';

export function WalletManagementPage({ onBack }: { onBack: () => void }) {
  return <WalletManagement onBack={onBack} />;
}
