import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import { Draw, Bet, GameType, BettingCondition, Client, PrizeRate, PositionalPrizeRates } from '../../types/index.ts';
import SortableHeader from '../common/SortableHeader.tsx';
import Modal from '../common/Modal.tsx';
import DrawProfitLossDetail from './DrawProfitLossDetail.tsx';

// Data structure for each row in the report
interface ReportRow {
    playedNumber: string; // The 4-digit number, e.g., '1452'
    source1D: Set<string>;
    source2D: Set<string>;
    source3D: Set<string>;
    source4D: Set<string>;
    totalStake: number;
    totalCommission: number;
    potentialPrize: number; // Based on the condition filter
}

type SortKey = 'playedNumber' | 'totalStake' | 'totalCommission' | 'potentialPrize' | 'netTotal';

const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const DrawProfitLossReport: React.FC<{ draw: Draw; conditionFilter: 'ALL' | 'FIRST' | 'SECOND' }> = ({ draw, conditionFilter }) => {
    const { bets, clients } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'potentialPrize', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [detailsForNumber, setDetailsForNumber] = useState<string | null>(null);
    const ITEMS_PER_PAGE = 100;

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

    const processedData = useMemo(() => {
        const reportMap = new Map<string, ReportRow>();
        
        let relevantBets = bets.filter(b => b.drawId === draw.id);
        if (conditionFilter !== 'ALL') {
            relevantBets = relevantBets.filter(b => b.condition === conditionFilter);
        }

        const getPrizeForBet = (bet: Bet, client: Client): number => {
            if (!client.prizeRates) return 0;

            const conditionKey = bet.condition.toLowerCase() as 'first' | 'second';
            let rate = 0;

            if (bet.gameType === GameType.Positional) {
                const digitCount = (bet.number.match(/\d/g) || []).length;
                const positionalRates = client.prizeRates.POSITIONAL;
                if (positionalRates && positionalRates[digitCount as keyof PositionalPrizeRates]) {
                    rate = positionalRates[digitCount as keyof PositionalPrizeRates][conditionKey];
                }
            } else {
                const gamePrizeRates = client.prizeRates[bet.gameType as keyof typeof client.prizeRates];
                if (gamePrizeRates && typeof (gamePrizeRates as PrizeRate)[conditionKey] === 'number') {
                    rate = (gamePrizeRates as PrizeRate)[conditionKey];
                }
            }
            return rate > 0 ? bet.stake * (rate / 100) : 0;
        };

        for (const bet of relevantBets) {
            const client = clientMap.get(bet.clientId);
            if (!client) continue;

            const commission = bet.stake * ((client.commissionRates?.[bet.gameType] ?? 0) / 100);
            const potentialPrize = getPrizeForBet(bet, client);

            const applyToReport = (prefix: string, length: number, sourceSetKey: keyof ReportRow) => {
                const correctedPrefix = prefix.substring(0, length);

                const multiplier = 10 ** (4 - length);
                for (let i = 0; i < multiplier; i++) {
                    const suffix = i.toString().padStart(4 - length, '0');
                    const fullNumber = correctedPrefix + suffix;

                    if (!reportMap.has(fullNumber)) {
                        reportMap.set(fullNumber, {
                            playedNumber: fullNumber,
                            source1D: new Set(), source2D: new Set(), source3D: new Set(), source4D: new Set(),
                            totalStake: 0, totalCommission: 0, potentialPrize: 0,
                        });
                    }
                    const entry = reportMap.get(fullNumber)!;
                    entry.totalStake += bet.stake;
                    entry.totalCommission += commission;
                    entry.potentialPrize += potentialPrize;
                    (entry[sourceSetKey] as Set<string>).add(bet.number);
                }
            };
            
            switch (bet.gameType) {
                case GameType.FourDigits: applyToReport(bet.number, 4, 'source4D'); break;
                case GameType.ThreeDigits: applyToReport(bet.number, 3, 'source3D'); break;
                case GameType.TwoDigits: applyToReport(bet.number, 2, 'source2D'); break;
                case GameType.OneDigit: applyToReport(bet.number, 1, 'source1D'); break;
                // Positional bets are complex and require a different logic
                case GameType.Positional:
                    // FIX: Truncate positional bet numbers to 4 characters to prevent oversized played numbers.
                    const correctedPositionalNumber = bet.number.substring(0, 4);

                    const digits = correctedPositionalNumber.split('').map((char, index) => (char !== 'X' ? { char, index } : null)).filter(Boolean);
                    const wildcards = 4 - (digits.length as number);
                    const combinations = 10 ** wildcards;

                    for(let i=0; i<combinations; i++) {
                        let tempNumber = correctedPositionalNumber.split('');
                        let combinationStr = i.toString().padStart(wildcards, '0');
                        let wildCardIdx = 0;
                        for(let j=0; j<4; j++) {
                            if(tempNumber[j] === 'X') {
                                tempNumber[j] = combinationStr[wildCardIdx++];
                            }
                        }
                        const fullNumber = tempNumber.join('');
                        
                        if (!reportMap.has(fullNumber)) {
                             reportMap.set(fullNumber, {
                                playedNumber: fullNumber,
                                source1D: new Set(), source2D: new Set(), source3D: new Set(), source4D: new Set(),
                                totalStake: 0, totalCommission: 0, potentialPrize: 0,
                            });
                        }

                        const entry = reportMap.get(fullNumber)!;
                        entry.totalStake += bet.stake;
                        entry.totalCommission += commission;
                        entry.potentialPrize += potentialPrize;
                        // For positional, we can just lump them into one category for simplicity of display. Let's use 2D as a catch-all.
                        (entry.source2D as Set<string>).add(bet.number);
                    }
                    break;
            }
        }
        return Array.from(reportMap.values());
    }, [draw.id, bets, clientMap, conditionFilter]);

    const displayedData = useMemo(() => {
        let data = [...processedData];
        if (searchTerm) {
            data = data.filter(item => item.playedNumber.includes(searchTerm));
        }

        data.sort((a, b) => {
            let valA, valB;
            const key = sort.key;
            if (key === 'netTotal') {
                valA = a.totalStake - a.totalCommission - a.potentialPrize;
                valB = b.totalStake - b.totalCommission - b.potentialPrize;
            } else {
                valA = a[key as keyof ReportRow];
                valB = b[key as keyof ReportRow];
            }
            if (typeof valA === 'object') valA = 0; // handle Set
            if (typeof valB === 'object') valB = 0;

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [processedData, searchTerm, sort]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return displayedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [displayedData, currentPage]);
    
    const totalPages = Math.ceil(displayedData.length / ITEMS_PER_PAGE);

    const handleSort = (key: SortKey) => {
        setSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
        setCurrentPage(1);
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, draw.id, conditionFilter]);

    // Actual winning numbers for highlighting
    const winningNumbersSet = new Set(draw.winningNumbers || []);

    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <input
                    type="text"
                    placeholder="Search for a played number..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-72 bg-brand-bg border border-brand-secondary rounded-lg py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <p className="text-sm text-brand-text-secondary">
                    Showing {paginatedData.length} of {displayedData.length} potential outcomes
                </p>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="min-w-full text-sm text-left text-brand-text-secondary whitespace-nowrap">
                    <thead className="text-xs text-brand-text uppercase bg-brand-secondary/80 sticky top-0">
                        <tr>
                            <SortableHeader onClick={() => handleSort('playedNumber')} sortKey="playedNumber" currentSort={sort.key} direction={sort.direction}>Played Number</SortableHeader>
                            <th className="px-4 py-3">1 Digit</th>
                            <th className="px-4 py-3">2 Digit / Combo / Multipositional</th>
                            <th className="px-4 py-3">3 Digit / Combo / Multipositional</th>
                            <th className="px-4 py-3">4 Digit / Combo / Multipositional</th>
                            <SortableHeader onClick={() => handleSort('totalStake')} sortKey="totalStake" currentSort={sort.key} direction={sort.direction} className="text-right">Stake Amount (₨)</SortableHeader>
                            <SortableHeader onClick={() => handleSort('totalCommission')} sortKey="totalCommission" currentSort={sort.key} direction={sort.direction} className="text-right">Commission (₨)</SortableHeader>
                            <SortableHeader onClick={() => handleSort('potentialPrize')} sortKey="potentialPrize" currentSort={sort.key} direction={sort.direction} className="text-right">If Declared Number Match → Prize Amount (₨)</SortableHeader>
                            <SortableHeader onClick={() => handleSort('netTotal')} sortKey="netTotal" currentSort={sort.key} direction={sort.direction} className="text-right">Net Total (₨)</SortableHeader>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-secondary/50">
                       {paginatedData.map(item => {
                           const netTotal = item.totalStake - item.totalCommission - item.potentialPrize;
                           const isWinner = winningNumbersSet.has(item.playedNumber);

                           return (
                            <tr key={item.playedNumber} className={`hover:bg-brand-secondary/30 ${isWinner ? 'bg-yellow-400/20' : ''}`}>
                                <td className={`px-4 py-2 font-mono font-bold`}>
                                    <button 
                                        onClick={() => setDetailsForNumber(item.playedNumber)} 
                                        className={`w-full text-left ${isWinner ? 'text-brand-primary' : 'text-brand-text'} hover:underline transition-colors`}
                                        title={`View details for ${item.playedNumber}`}
                                    >
                                        {item.playedNumber}
                                    </button>
                                </td>
                                <td className="px-4 py-2 font-mono">{[...item.source1D].join(', ')}</td>
                                <td className="px-4 py-2 font-mono">{[...item.source2D].join(', ')}</td>
                                <td className="px-4 py-2 font-mono">{[...item.source3D].join(', ')}</td>
                                <td className="px-4 py-2 font-mono">{[...item.source4D].join(', ')}</td>
                                <td className="px-4 py-2 font-mono text-right">{formatCurrency(item.totalStake)}</td>
                                <td className="px-4 py-2 font-mono text-right text-blue-400">{formatCurrency(item.totalCommission)}</td>
                                <td className="px-4 py-2 font-mono text-right text-yellow-400">{formatCurrency(item.potentialPrize)}</td>
                                <td className={`px-4 py-2 font-mono text-right font-bold ${netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(netTotal)}</td>
                            </tr>
                           )
                       })}
                    </tbody>
                </table>
                 {displayedData.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-brand-text-secondary">No betting data found{searchTerm && ' with the current filter'}.</p>
                    </div>
                )}
            </div>
             {totalPages > 1 && (
                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage === 1}
                        className="bg-brand-secondary hover:bg-opacity-80 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                    >
                        &larr; Previous
                    </button>
                    <span className="font-semibold text-brand-text-secondary">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage === totalPages}
                        className="bg-brand-secondary hover:bg-opacity-80 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Next &rarr;
                    </button>
                </div>
            )}

            {detailsForNumber && (
                <Modal title={`Bet Details for Number: ${detailsForNumber}`} onClose={() => setDetailsForNumber(null)}>
                    <DrawProfitLossDetail 
                        draw={draw}
                        playedNumber={detailsForNumber}
                        conditionFilter={conditionFilter}
                    />
                </Modal>
            )}
        </div>
    );
};

export default DrawProfitLossReport;
