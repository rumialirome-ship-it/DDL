import React from 'react';
import * as ReactRouterDom from 'react-router-dom';
import { Client, Role } from '../../types/index.ts';

// FIX: Inlined the Logo component to resolve a persistent build error.
const Logo: React.FC<{ className?: string }> = ({ className = 'h-8 w-8 text-brand-primary' }) => (
    <svg 
        className={className}
        viewBox="0 0 24 24" 
        fill="currentColor" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Daily Dubai Lottery Logo"
    >
        <path d="M12 1.5L14.05 8.35L21.5 9.25L16.25 14.25L17.6 21.65L12 17.9L6.4 21.65L7.75 14.25L2.5 9.25L9.95 8.35L12 1.5Z" opacity="0.4"/>
        <path d="M12 5.5L10.5 10.05L5.5 10.9L9.2 14.4L8.25 19.3L12 16.85L15.75 19.3L14.8 14.4L18.5 10.9L13.5 10.05L12 5.5Z"/>
    </svg>
);

const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

interface HeaderProps {
    client: Client | null;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ client, onLogout }) => {
    const navigate = ReactRouterDom.useNavigate();
    const location = ReactRouterDom.useLocation();

    const showBackButton = location.pathname !== '/';

    return (
        <header className="fixed top-0 left-0 w-full bg-brand-surface border-b border-brand-secondary z-40 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-4">
                        {showBackButton && (
                             <button
                                onClick={() => navigate(-1)}
                                className="text-brand-text-secondary hover:text-brand-text p-2 rounded-full -ml-2"
                                aria-label="Go back to previous page"
                            >
                                <BackArrowIcon />
                            </button>
                        )}
                        <ReactRouterDom.Link to="/" className="flex items-center gap-3 text-2xl font-bold text-brand-primary hover:text-yellow-300 transition-colors">
                            <Logo />
                            <span className="hidden sm:inline">Daily Dubai Lottery</span>
                        </ReactRouterDom.Link>
                    </div>
                    <div className="flex items-center space-x-4">
                        {client ? (
                            <>
                                <div className="text-right hidden sm:block">
                                    <span className="text-brand-text font-semibold">{client.username}</span>
                                    <span className="block text-xs text-brand-text-secondary">
                                        {client.role === Role.Admin ? 'Administrator' : `ID: ${client.clientId}`}
                                    </span>
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="bg-danger hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                           <ReactRouterDom.Link to="/login" className="bg-brand-primary text-brand-bg font-bold py-2 px-4 rounded-lg text-sm hover:shadow-glow transition-all">
                                Login
                           </ReactRouterDom.Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;