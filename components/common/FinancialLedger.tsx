import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import { TransactionType, Role, Bet } from '../../types/index.ts';

const FinancialLedger: React.FC<{ clientId: string }> = ({ clientId }) => {
    const { transactions, clients, currentClient, bets } = useAppContext();
    const [dateFilter, setDateFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const client = useMemo(() => {
        if (currentClient?.role === Role.Client && currentClient.id === clientId) {
            return currentClient;
        }
        return clients.find(c => c.id === clientId);
    }, [clients, clientId, currentClient]);

    const getDateRange = (filter: string) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        switch (filter) {
            case 'today':
                return { start: today, end: new Date(now.getTime() + 1) };
            case 'last7':
                const last7 = new Date(today);
                last7.setDate(today.getDate() - 6);
                return { start: last7, end: new Date(now.getTime() + 1) };
            case 'last30':
                const last30 = new Date(today);
                last30.setDate(today.getDate() - 29);
                return { start: last30, end: new Date(now.getTime() + 1) };
            default:
                return null; // All time
        }
    };

    const filteredTransactions = useMemo(() => {
        const clientTxs = transactions
            .filter(t => t.clientId === clientId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const range = getDateRange(dateFilter);
        if (!range) {
            return clientTxs;
        }

        return clientTxs.filter(tx => {
            const txDate = new Date(tx.createdAt);
            return txDate >= range.start && txDate < range.end;
        });
    }, [transactions, clientId, dateFilter]);
    
    const winPattern = /^Win on (.*?) \((.*?)\) in Draw (.*?)\. Stake ([\d.]+) @ ([\d.]+)x$/;

    const { detailedTransactions, summary } = useMemo(() => {
        let totalCredit = 0, totalDebit = 0, totalStakes = 0, totalWinnings = 0, totalCommission = 0, totalNetProfit = 0;

        const details = filteredTransactions.map(tx => {
            let netProfit = 0;
            let commission = 0;

            if (tx.type === TransactionType.Credit) {
                totalCredit += tx.amount;
                if (tx.description.startsWith('Win on')) {
                    totalWinnings += tx.amount;
                    const match = winPattern.exec(tx.description);
                    if (match) {
                        const stake = parseFloat(match[4]);
                        netProfit = tx.amount - stake;
                        totalNetProfit += netProfit;
                    }
                } else if (tx.description.startsWith('Betting Commission')) {
                    commission = tx.amount;
                    totalCommission += commission;
                }
            } else { // DEBIT
                totalDebit += tx.amount;
                if (tx.description.toLowerCase().includes('booking')) {
                    totalStakes += tx.amount;
                }
            }
            return { ...tx, netProfit, commission };
        });

        const netResult = (totalWinnings - totalStakes) + totalCommission;

        return {
            detailedTransactions: details,
            summary: { totalCredit, totalDebit, totalStakes, totalWinnings, totalCommission, totalNetProfit, netResult }
        };
    }, [filteredTransactions]);


    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return detailedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [detailedTransactions, currentPage]);

    const totalPages = Math.ceil(detailedTransactions.length / ITEMS_PER_PAGE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };
    
    if (!client) {
        return <p className="text-brand-text-secondary">Client not found.</p>;
    }

    const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const filterOptions = [
        { key: 'all', label: 'All Time' },
        { key: 'today', label: 'Today' },
        { key: 'last7', label: 'Last 7 Days' },
        { key: 'last30', label: 'Last 30 Days' },
    ];
    
    const FilterButton: React.FC<{ filterKey: string; label: string }> = ({ filterKey, label }) => (
        <button
            onClick={() => { setDateFilter(filterKey); setCurrentPage(1); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                dateFilter === filterKey
                    ? 'bg-brand-primary text-brand-bg'
                    : 'bg-brand-surface text-brand-text-secondary hover:bg-brand-secondary'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row gap-4">
                <div className="bg-brand-bg p-3 rounded-lg border border-brand-secondary flex flex-wrap items-center gap-2 flex-grow">
                    <span className="text-sm font-bold text-brand-text-secondary mr-2">Period:</span>
                    {filterOptions.map(opt => <FilterButton key={opt.key} filterKey={opt.key} label={opt.label} />)}
                </div>
            </div>

            {detailedTransactions.length === 0 ? (
                <div className="text-center py-8 bg-brand-bg rounded-lg">
                    <p className="text-brand-text-secondary">No financial history found for the selected period.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto bg-brand-bg rounded-lg max-h-[60vh]">
                        <table className="min-w-full text-sm text-left text-brand-text-secondary">
                            <thead className="text-xs text-brand-text uppercase bg-brand-secondary/80 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Date</th>
                                    <th scope="col" className="px-6 py-3">Description</th>
                                    <th scope="col" className="px-6 py-3 text-right">Debit</th>
                                    <th scope="col" className="px-6 py-3 text-right">Credit</th>
                                    <th scope="col" className="px-6 py-3 text-right">Commission</th>
                                    <th scope="col" className="px-6 py-3 text-right">Net Profit</th>
                                    <th scope="col" className="px-6 py-3 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-secondary/50">
                                {paginatedTransactions.map((tx) => (
                                    <tr key={tx.id} className={`hover:bg-brand-secondary/30 ${tx.isReversed ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                                        <td className="px-6 py-3 max-w-xs">{tx.description} {tx.isReversed && <span className="ml-2 text-xs font-bold text-red-400 bg-red-900/50 px-2 py-0.5 rounded-full">REVERSED</span>}</td>
                                        <td className={`px-6 py-3 text-right font-mono text-yellow-400 ${tx.isReversed ? 'line-through' : ''}`}>
                                            {tx.type === TransactionType.Debit ? `RS. ${formatCurrency(tx.amount)}` : '-'}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-mono text-green-400 ${tx.isReversed ? 'line-through' : ''}`}>
                                            {tx.type === TransactionType.Credit ? `RS. ${formatCurrency(tx.amount)}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-blue-400">
                                            {tx.commission > 0 ? `RS. ${formatCurrency(tx.commission)}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-green-400">
                                            {tx.netProfit > 0 ? `RS. ${formatCurrency(tx.netProfit)}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-brand-text">RS. {formatCurrency(tx.balanceAfter)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-brand-secondary/80 font-bold text-brand-text">
                                <tr>
                                    <td className="px-6 py-3 text-right" colSpan={2}>Period Totals</td>
                                    <td className="px-6 py-3 text-right font-mono text-yellow-400">{formatCurrency(summary.totalDebit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatCurrency(summary.totalCredit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-400">{formatCurrency(summary.totalCommission)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatCurrency(summary.totalNetProfit)}</td>
                                    <td className="px-6 py-3 text-right font-mono"></td>
                                </tr>
                                 <tr>
                                    <td className="px-6 py-4 text-right border-t-2 border-brand-primary" colSpan={5}>Net Result for Period (Winnings + Commission - Stakes)</td>
                                    <td className={`px-6 py-4 text-right font-mono text-xl border-t-2 border-brand-primary ${summary.netResult >= 0 ? 'text-brand-primary' : 'text-danger'}`} colSpan={2}>
                                        {formatCurrency(summary.netResult)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="bg-brand-secondary hover:bg-opacity-80 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                &larr; Previous
                            </button>
                            <span className="text-brand-text-secondary font-semibold">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="bg-brand-secondary hover:bg-opacity-80 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next &rarr;
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FinancialLedger;