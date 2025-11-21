import React, { useState } from 'react';
import * as WalletInfoModule from './WalletInfo.tsx';
const WalletInfo = WalletInfoModule.default;
import * as BettingInterfaceModule from './BettingInterface.tsx';
const BettingInterface = BettingInterfaceModule.default;
import * as BetHistoryModule from './BetHistory.tsx';
const BetHistory = BetHistoryModule.default;
import * as ClientTabButtonModule from './ClientTabButton.tsx';
const ClientTabButton = ClientTabButtonModule.default;
import * as RuleBasedBulkBettingModule from './RuleBasedBulkBetting.tsx';
const RuleBasedBulkBetting = RuleBasedBulkBettingModule.default;
import * as FinancialStatementModule from './FinancialStatement.tsx';
const FinancialStatement = FinancialStatementModule.default;
import * as WalletManagementModule from './WalletManagement.tsx';
const WalletManagement = WalletManagementModule.default;
import * as ClientProfileModule from './ClientProfile.tsx';
const ClientProfile = ClientProfileModule.default;

const ClientDashboard = () => {
    const [activeTab, setActiveTab] = useState('bulk-betting');

    return (
        <div className="space-y-8">
            <WalletInfo />
            <div className="bg-brand-surface rounded-xl shadow-lg border border-brand-secondary">
                <div className="border-b border-brand-secondary px-4 md:px-6">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto">
                        <ClientTabButton tabId="booking" activeTab={activeTab} onClick={setActiveTab}>Place Bet</ClientTabButton>
                        <ClientTabButton tabId="bulk-betting" activeTab={activeTab} onClick={setActiveTab}>Bulk Betting</ClientTabButton>
                        <ClientTabButton tabId="history" activeTab={activeTab} onClick={setActiveTab}>Bet History</ClientTabButton>
                        <ClientTabButton tabId="statement" activeTab={activeTab} onClick={setActiveTab}>Financial Statement</ClientTabButton>
                        <ClientTabButton tabId="wallet" activeTab={activeTab} onClick={setActiveTab}>Manage Wallet</ClientTabButton>
                        <ClientTabButton tabId="profile" activeTab={activeTab} onClick={setActiveTab}>Profile</ClientTabButton>
                    </nav>
                </div>
                <div className="p-4 md:p-6">
                    {activeTab === 'booking' && <BettingInterface />}
                    {activeTab === 'bulk-betting' && <RuleBasedBulkBetting />}
                    {activeTab === 'history' && <BetHistory />}
                    {activeTab === 'statement' && <FinancialStatement />}
                    {activeTab === 'wallet' && <WalletManagement />}
                    {activeTab === 'profile' && <ClientProfile />}
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;