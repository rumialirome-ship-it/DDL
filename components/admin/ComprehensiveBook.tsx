import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import { Draw, GameType, BettingCondition } from '../../types/index.ts';
import SortableHeader from '../common/SortableHeader.tsx';

// --- New Interfaces for Detailed Reporting ---

interface StakeDetail {
  stake: number;
  sources: string[];
}

// This interface is used during the data processing phase with Sets for efficient unique source tracking.
interface ProcessingStakeDetail {
  stake: number;
  sources: Set<string>;
}

// This is the final data structure for each 4-digit number row after processing.
interface NumberReport {
  number: string;
  '4D': StakeDetail;
  '3D': StakeDetail;
  '2D': StakeDetail;
  '1D': StakeDetail;
  total: number;
}

// This interface is used for the intermediate data structure within the processing Map.
interface ProcessingNumberReport {
  '4D': ProcessingStakeDetail;
  '3D': ProcessingStakeDetail;
  '2D': ProcessingStakeDetail;
  '1D': ProcessingStakeDetail;
  total: number;
}


type SortKey = 'number' | '4D' | '3D' | '2D' | '1D' | 'total';

const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// --- New Component to Render Stake and Source Numbers ---

const StakeCell: React.FC<{ data: StakeDetail }> = ({ data }) => {
    if (data.stake === 0) return <>{formatCurrency(0)}</>;
    
    return (
        <div className="flex flex-col items-end">
            <span>{formatCurrency(data.stake)}</span>
            {data.sources.length > 0 && (
                 <span className="text-xs text-brand-text-secondary -mt-1 font-normal opacity-80">
                    (from {data.sources.join(', ')})
                 </span>
            )}
        </div>
    );
};


const ComprehensiveBook: React.FC<{ draw: Draw; conditionFilter: 'ALL' | 'FIRST' | 'SECOND' }> = ({ draw, conditionFilter }) => {
    const { bets } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    const processedData: NumberReport[] = useMemo(() => {
        const reportData = new Map<string, ProcessingNumberReport>();
        let relevantBets = bets.filter(b => b.drawId === draw.id);

        if (conditionFilter !== 'ALL') {
            relevantBets = relevantBets.filter(b => b.condition === conditionFilter);
        }

        const initializeEntry = (num: string) => {
            if (!reportData.has(num)) {
                reportData.set(num, {
                    '4D': { stake: 0, sources: new Set() },
                    '3D': { stake: 0, sources: new Set() },
                    '2D': { stake: 0, sources: new Set() },
                    '1D': { stake: 0, sources: new Set() },
                    total: 0
                });
            }
            return reportData.get(num)!;
        };

        for (const bet of relevantBets) {
            const { gameType, number, stake } = bet;

            switch (gameType) {
                case GameType.FourDigits: {
                    const entry = initializeEntry(number);
                    entry['4D'].stake += stake;
                    entry.total += stake;
                    break;
                }
                case GameType.ThreeDigits: {
                    for (let i = 0; i < 10; i++) {
                        const fullNumber = number + i.toString();
                        const entry = initializeEntry(fullNumber);
                        entry['3D'].stake += stake;
                        entry['3D'].sources.add(number);
                        entry.total += stake;
                    }
                    break;
                }
                case GameType.TwoDigits: {
                    for (let i = 0; i < 100; i++) {
                        const fullNumber = number + i.toString().padStart(2, '0');
                        const entry = initializeEntry(fullNumber);
                        entry['2D'].stake += stake;
                        entry['2D'].sources.add(number);
                        entry.total += stake;
                    }
                    break;
                }
                case GameType.OneDigit: {
                    for (let i = 0; i < 1000; i++) {
                        const fullNumber = number + i.toString().padStart(3, '0');
                        const entry = initializeEntry(fullNumber);
                        entry['1D'].stake += stake;
                        entry['1D'].sources.add(number);
                        entry.total += stake;
                    }
                    break;
                }
            }
        }
        return Array.from(reportData.entries()).map(([number, data]) => ({
            number,
            '4D': { stake: data['4D'].stake, sources: Array.from(data['4D'].sources) },
            '3D': { stake: data['3D'].stake, sources: Array.from(data['3D'].sources) },
            '2D': { stake: data['2D'].stake, sources: Array.from(data['2D'].sources) },
            '1D': { stake: data['1D'].stake, sources: Array.from(data['1D'].sources) },
            total: data.total
        }));
    }, [draw.id, bets, conditionFilter]);
    
    const displayedData = useMemo(() => {
        let data = [...processedData];

        if (searchTerm) {
            data = data.filter(item => item.number.includes(searchTerm));
        }

        data.sort((a, b) => {
            const key = sort.key;
            const dir = sort.direction;

            const valA = (key === 'number' || key === 'total') ? a[key] : a[key].stake;
            const valB = (key === 'number' || key === 'total') ? b[key] : b[key].stake;

            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <input
                    type="text"
                    placeholder="Search for a number..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-72 bg-brand-bg border border-brand-secondary rounded-lg py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <p className="text-sm text-brand-text-secondary">
                    Showing {paginatedData.length} of {displayedData.length} entries
                </p>
            </div>
            
            <div className="overflow-x-auto max-h-[60vh]">
                 <table className="min-w-full text-sm text-left text-brand-text-secondary">
                    <thead className="text-xs text-brand-text uppercase bg-brand-secondary/80 sticky top-0">
                        <tr>
                            <SortableHeader onClick={() => handleSort('number')} sortKey="number" currentSort={sort.key} direction={sort.direction}>Number</SortableHeader>
                            <SortableHeader onClick={() => handleSort('4D')} sortKey="4D" currentSort={sort.key} direction={sort.direction} className="text-right">4D Stake</SortableHeader>
                            <SortableHeader onClick={() => handleSort('3D')} sortKey="3D" currentSort={sort.key} direction={sort.direction} className="text-right">3D Stake</SortableHeader>
                            <SortableHeader onClick={() => handleSort('2D')} sortKey="2D" currentSort={sort.key} direction={sort.direction} className="text-right">2D Stake</SortableHeader>
                            <SortableHeader onClick={() => handleSort('1D')} sortKey="1D" currentSort={sort.key} direction={sort.direction} className="text-right">1D Stake</SortableHeader>
                            <SortableHeader onClick={() => handleSort('total')} sortKey="total" currentSort={sort.key} direction={sort.direction} className="text-right">Total Stake</SortableHeader>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-secondary/50">
                        {paginatedData.map(item => (
                            <tr key={item.number} className="hover:bg-brand-secondary/30">
                                <td className="px-6 py-2 font-mono font-bold text-brand-text">{item.number}</td>
                                <td className="px-6 py-2 font-mono text-right">{formatCurrency(item['4D'].stake)}</td>
                                <td className="px-6 py-2 font-mono text-right"><StakeCell data={item['3D']} /></td>
                                <td className="px-6 py-2 font-mono text-right"><StakeCell data={item['2D']} /></td>
                                <td className="px-6 py-2 font-mono text-right"><StakeCell data={item['1D']} /></td>
                                <td className="px-6 py-2 font-mono text-right font-bold text-brand-primary">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {displayedData.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-brand-text-secondary">No betting data found for this draw{searchTerm && ' with the current filter'}.</p>
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
        </div>
    );
};

export default ComprehensiveBook;