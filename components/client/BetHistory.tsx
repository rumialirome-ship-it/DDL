import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import * as BetResultModule from './BetResult.tsx';
const BetResult = BetResultModule.default;
import { GameType } from '../../types/index.ts';
import { getGameTypeDisplayName } from '../../utils/helpers.ts';

const BetHistory: React.FC = () => {
    const { currentClient, bets, draws } = useAppContext();
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const drawMap = useMemo(() => new Map(draws.map(d => [d.id, d])), [draws]);

    const allClientBets = useMemo(() => 
        currentClient 
            ? bets.filter(b => b.clientId === currentClient.id).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()) 
            : [], 
        [currentClient, bets]
    );

    const availableDates = useMemo(() => {
        const dates = new Set(allClientBets.map(b => new Date(b.createdAt).toLocaleDateString()));
        return Array.from(dates);
    }, [allClientBets]);

    const filteredBets = useMemo(() => {
        if (selectedDate === 'all') {
            return allClientBets;
        }
        return allClientBets.filter(b => new Date(b.createdAt).toLocaleDateString() === selectedDate);
    }, [allClientBets, selectedDate]);

    if (!currentClient) return null;

    if (allClientBets.length === 0) {
        return <div className="text-center py-8"><p className="text-brand-text-secondary">You haven't placed any bets yet.</p></div>
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-bold text-brand-text">Your Bet History</h2>
                <div className="w-full md:w-auto">
                    <label htmlFor="date-filter" className="sr-only">Filter by Date</label>
                    <select
                        id="date-filter"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-secondary rounded-lg py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    >
                        <option value="all">All History</option>
                        {availableDates.map(date => (
                            <option key={date} value={date}>{date}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto bg-brand-bg rounded-lg shadow-md">
                <table className="min-w-full text-sm text-left text-brand-text-secondary">
                    <thead className="text-xs text-brand-text uppercase bg-brand-secondary/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Draw</th>
                            <th scope="col" className="px-6 py-3">Game</th>
                            <th scope="col" className="px-6 py-3">Number</th>
                            <th scope="col" className="px-6 py-3">Condition</th>
                            <th scope="col" className="px-6 py-3 text-right">Stake</th>
                            <th scope="col" className="px-6 py-3 text-right">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBets.map(bet => {
                            const draw = drawMap.get(bet.drawId);
                            return (
                                <tr key={bet.id} className="bg-brand-surface border-b border-brand-secondary hover:bg-brand-surface/50">
                                    <td className="px-6 py-4">{new Date(bet.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-4 font-medium text-brand-text">{draw ? `Draw ${draw.name}` : 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        {getGameTypeDisplayName(bet.gameType)}
                                        {bet.gameType === GameType.Positional && bet.positions && (
                                            <span className="text-xs block text-brand-text-secondary">
                                                Pos: [{bet.positions.join(',')}]
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-brand-primary">{bet.number}</td>
                                    <td className="px-6 py-4">{bet.condition}</td>
                                    <td className="px-6 py-4 text-right font-mono">{bet.stake.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-right"><BetResult bet={bet} draw={draw} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {filteredBets.length === 0 && selectedDate !== 'all' && (
                    <p className="text-center py-4 text-brand-text-secondary">No bets found for {selectedDate}.</p>
                )}
            </div>
        </div>
    );
};

export default BetHistory;