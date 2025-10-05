import React from 'react';
import { useAppContext } from '../../contexts/AppContext.tsx';
import { Draw, DrawStatus } from '../../types/index.ts';
import * as CountdownModule from './Countdown.tsx';
const Countdown = CountdownModule.default;

const getStatusStyles = (status: DrawStatus) => {
    switch (status) {
        case DrawStatus.Open: return { badge: 'bg-green-500/20 text-green-400', text: 'text-green-400' };
        case DrawStatus.Closed: return { badge: 'bg-yellow-500/20 text-yellow-400', text: 'text-yellow-400' };
        case DrawStatus.Declared: return { badge: 'bg-yellow-500/20 text-yellow-400', text: 'text-yellow-400' };
        case DrawStatus.Finished: return { badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-400' };
        case DrawStatus.Upcoming: return { badge: 'bg-gray-500/20 text-gray-400', text: 'text-gray-400' };
        case DrawStatus.Suspended: return { badge: 'bg-red-500/20 text-red-400', text: 'text-red-400' };
        default: return { badge: 'bg-brand-secondary text-brand-text-secondary', text: 'text-brand-text-secondary' };
    }
};

const DrawStatusCard: React.FC<{ draw: Draw }> = ({ draw }) => {
    const styles = getStatusStyles(draw.status);
    const displayTime = draw.drawTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const showNumbers = draw.status === DrawStatus.Finished || draw.status === DrawStatus.Declared;

    return (
        <div className="bg-brand-surface border border-brand-secondary p-4 rounded-xl shadow-lg text-center flex flex-col justify-between h-full transition-all duration-300 hover:border-brand-primary/80 hover:shadow-glow transform hover:-translate-y-1">
            {/* Card Header: Draw Info */}
            <div className="border-b border-brand-secondary/50 pb-2 mb-3">
                 <h3 className="font-bold text-brand-text text-lg">{`Draw ${draw.name}`}</h3>
                 <p className="text-sm text-brand-text-secondary">{displayTime}</p>
            </div>
            
            {/* Card Body: Status or Winning Numbers */}
            <div className="flex-grow flex flex-col items-center justify-center min-h-[100px]">
                {showNumbers ? (
                     <div className="w-full space-y-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-block ${styles.badge}`}>
                           {draw.status === DrawStatus.Finished ? 'Result Declared' : 'Declared'}
                        </span>
                        {draw.winningNumbers && draw.winningNumbers.length > 0 ? (
                            <>
                                <div>
                                    <p className="text-xs text-brand-primary font-semibold">First (F)</p>
                                    <p className="text-brand-primary font-bold text-4xl leading-tight tracking-wider font-mono" title="First Position Number (F)">
                                        {draw.winningNumbers[0]}
                                    </p>
                                </div>
                                {draw.winningNumbers.length > 1 && (
                                    <div>
                                        <p className="text-xs text-green-400 font-semibold">Second (S)</p>
                                        <div className="text-green-400 text-lg font-mono" title="Second Position Numbers (S)">
                                            {draw.winningNumbers.slice(1).join(' • ')}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                             <p className="text-brand-text-secondary text-sm font-mono">(Numbers Missing)</p>
                        )}
                    </div>
                ) : draw.status === DrawStatus.Open ? (
                    <div>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full mb-2 inline-block ${styles.badge}`}>
                            {draw.status}
                        </span>
                        <div className="mt-1">
                            <p className="text-xs text-brand-text-secondary mb-1">Booking closes in:</p>
                            <Countdown targetDate={new Date(draw.drawTime.getTime() - 15 * 60 * 1000)} />
                        </div>
                    </div>
                ) : (
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${styles.badge}`}>
                        {draw.status}
                    </span>
                )}
            </div>
        </div>
    );
};


const MarketStatus: React.FC = () => {
    const { draws } = useAppContext();
    
    return (
        <div className="bg-brand-surface/50 p-6 rounded-xl shadow-lg border border-brand-secondary">
            <h2 className="text-2xl font-semibold text-brand-primary mb-4 text-center">Today's Draw Status ({draws.length > 0 ? `${draws.length} Draws` : ''})</h2>

            {draws.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                     {draws.sort((a, b) => a.drawTime.getTime() - b.drawTime.getTime()).map(draw => (
                        <DrawStatusCard key={draw.id} draw={draw} />
                    ))}
                </div>
            ) : (
                <p className="text-center text-brand-text-secondary my-4">No draws scheduled for today.</p>
            )}
        </div>
    );
};

export default MarketStatus;