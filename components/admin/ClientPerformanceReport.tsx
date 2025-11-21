import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import { Draw, Bet, Client, GameType, BettingCondition, PrizeRate, PositionalPrizeRates, DrawStatus } from '../../types/index.ts';
import { isBetWinner } from '../../utils/helpers.ts';
import SortableHeader from '../common/SortableHeader.tsx';

interface ClientReportRow {
    client: Client;
    totalStake: number;
    totalWinnings: number;
    totalCommission: number;
    netResult: number;
    betCount: number;
}

type SortKey = 'client' | 'totalStake' | 'totalWinnings' | 'totalCommission' | 'netResult' | 'betCount';

const ClientPerformanceReport: React.FC<{ draw: Draw }> = ({ draw }) => {
    const { bets, clients } = useAppContext();
    const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'netResult', direction: 'asc' });

    const clientReportData = useMemo(() => {
        if (!draw || (draw.status !== DrawStatus.Finished && draw.status !== DrawStatus.Declared)) {
            return [];
        }

        const clientMap = new Map<string, ClientReportRow>();
        const drawBets = bets.filter(b => b.drawId === draw.id);
        const participatingClientIds = new Set(drawBets.map(b => b.clientId));

        for (const client of clients) {
            if (participatingClientIds.has(client.id)) {
                clientMap.set(client.id, {
                    client,
                    totalStake: 0,
                    totalWinnings: 0,
                    totalCommission: 0,
                    netResult: 0,
                    betCount: 0,
                });
            }
        }
        
        for (const bet of drawBets) {
            const reportRow = clientMap.get(bet.clientId);
            if (!reportRow) continue;

            reportRow.totalStake += bet.stake;
            reportRow.betCount += 1;

            const client = reportRow.client;
            
            const commissionRate = client.commissionRates?.[bet.gameType] ?? 0;
            const commission = bet.stake * (commissionRate / 100);
            reportRow.totalCommission += commission;

            if (isBetWinner(bet, draw.winningNumbers)) {
                let prizeWon = 0;
                if (client.prizeRates) {
                    const conditionKey = bet.condition.toLowerCase() as 'first' | 'second';
                    let rate = 0;

                    if (bet.gameType === GameType.Positional) {
                        const digitCount = (bet.number.match(/\d/g) || []).length;
                        const positionalRates = client.prizeRates.POSITIONAL;
                        if (positionalRates && positionalRates[digitCount as keyof PositionalPrizeRates]) {
                            const prizeRate: PrizeRate = positionalRates[digitCount as keyof PositionalPrizeRates];
                            rate = prizeRate[conditionKey];
                        }
                    } else {
                        const gamePrizeRates = client.prizeRates[bet.gameType as keyof typeof client.prizeRates];
                        if (gamePrizeRates && typeof (gamePrizeRates as PrizeRate)[conditionKey] === 'number') {
                             rate = (gamePrizeRates as PrizeRate)[conditionKey];
                        }
                    }
                    if (rate > 0) {
                        prizeWon = bet.stake * (rate / 100);
                    }
                }
                reportRow.totalWinnings += prizeWon;
            }
        }
        
        for (const row of clientMap.values()) {
            row.netResult = (row.totalWinnings + row.totalCommission) - row.totalStake;
        }

        return Array.from(clientMap.values());
    }, [draw, bets, clients]);

    const sortedData = useMemo(() => {
        return [...clientReportData].sort((a, b) => {
            const key = sort.key;
            let valA, valB;
            if (key === 'client') {
                valA = a.client.username;
                valB = b.client.username;
            } else {
                valA = a[key as keyof Omit<ClientReportRow, 'client'>];
                valB = b[key as keyof Omit<ClientReportRow, 'client'>];
            }
            
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [clientReportData, sort]);

    const handleSort = (key: SortKey) => {
        setSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };
    
    const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const totals = useMemo(() => {
        return clientReportData.reduce((acc, row) => {
            acc.totalStake += row.totalStake;
            acc.totalWinnings += row.totalWinnings;
            acc.totalCommission += row.totalCommission;
            acc.netResult += row.netResult;
            acc.betCount += row.betCount;
            return acc;
        }, { totalStake: 0, totalWinnings: 0, totalCommission: 0, netResult: 0, betCount: 0 });
    }, [clientReportData]);

    if (!draw || (draw.status !== DrawStatus.Finished && draw.status !== DrawStatus.Declared)) {
        return <p className="text-center text-brand-text-secondary py-4">This report is only available for finished or declared draws.</p>;
    }
    
    if (clientReportData.length === 0) {
        return <p className="text-center text-brand-text-secondary py-4">No client betting data found for this draw.</p>;
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto max-h-[70vh]">
                <table className="min-w-full text-sm text-left text-brand-text-secondary">
                    <thead className="text-xs text-brand-text uppercase bg-brand-secondary/80 sticky top-0">
                        <tr>
                            <SortableHeader onClick={() => handleSort('client')} sortKey="client" currentSort={sort.key} direction={sort.direction}>Client</SortableHeader>
                            <SortableHeader onClick={() => handleSort('betCount')} sortKey="betCount" currentSort={sort.key} direction={sort.direction} className="text-center">Bets</SortableHeader>
                            <SortableHeader onClick={() => handleSort('totalStake')} sortKey="totalStake" currentSort={sort.key} direction={sort.direction} className="text-right">Total Stake</SortableHeader>
                            <SortableHeader onClick={() => handleSort('totalCommission')} sortKey="totalCommission" currentSort={sort.key} direction={sort.direction} className="text-right">Commission</SortableHeader>
                            <SortableHeader onClick={() => handleSort('totalWinnings')} sortKey="totalWinnings" currentSort={sort.key} direction={sort.direction} className="text-right">Winnings</SortableHeader>
                            <SortableHeader onClick={() => handleSort('netResult')} sortKey="netResult" currentSort={sort.key} direction={sort.direction} className="text-right">Net Result (for Client)</SortableHeader>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-secondary/50">
                        {sortedData.map(row => (
                            <tr key={row.client.id} className="hover:bg-brand-secondary/30">
                                <td className="px-4 py-2 font-medium text-brand-text whitespace-nowrap">{row.client.username} ({row.client.clientId})</td>
                                <td className="px-4 py-2 text-center font-mono">{row.betCount}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatCurrency(row.totalStake)}</td>
                                <td className="px-4 py-2 text-right font-mono text-blue-400">{formatCurrency(row.totalCommission)}</td>
                                <td className="px-4 py-2 text-right font-mono text-green-400">{formatCurrency(row.totalWinnings)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.netResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {row.netResult >= 0 ? '+' : ''}{formatCurrency(row.netResult)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-brand-secondary/80 font-bold text-brand-text">
                         <tr>
                            <td colSpan={1} className="px-4 py-3 text-right">TOTALS</td>
                            <td className="px-4 py-3 text-center font-mono">{totals.betCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.totalStake)}</td>
                            <td className="px-4 py-3 text-right font-mono text-blue-400">{formatCurrency(totals.totalCommission)}</td>
                            <td className="px-4 py-3 text-right font-mono text-green-400">{formatCurrency(totals.totalWinnings)}</td>
                            <td className={`px-4 py-3 text-right font-mono ${totals.netResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                 {totals.netResult >= 0 ? '+' : ''}{formatCurrency(totals.netResult)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default ClientPerformanceReport;
