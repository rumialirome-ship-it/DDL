import React, { useState, useContext, createContext, useMemo, useCallback, useEffect, useRef } from 'react';
import { Client, Draw, Bet, Role, AppContextType, DrawStatus, BettingCondition, GameType, MarketOverride, Transaction, TransactionType, ClientImportData } from '../types/index.ts';
import { normalizeClientData } from '../utils/helpers.ts';
import { defaultPrizeRates, defaultCommissionRates } from '../data/mockData.ts';

const AppContext = createContext<AppContextType | null>(null);

// Helper for API calls
const apiFetch = async (path: string, options: RequestInit = {}) => {
    const API_BASE_URL = ''; // Backend server address is relative
    const token = localStorage.getItem('ddl_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred.' }));
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        if (response.status === 204) { // Handle No Content response
            return null;
        }
        return response.json();
    } catch (error) {
        console.error(`API call to ${API_BASE_URL}/api${path} failed:`, error);
        throw error;
    }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [draws, setDraws] = useState<Draw[]>([]);
    const [bets, setBets] = useState<Bet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [marketOverride, setMarketOverrideState] = useState<MarketOverride>('AUTO');
    const [currentClient, setCurrentClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingTimeoutRef = useRef<number | null>(null);


    const fetchDataForUser = useCallback(async () => {
        if (!localStorage.getItem('ddl_token')) {
            setIsLoading(false);
            return;
        }
        try {
            // FIX: Call the new role-agnostic endpoint to get user data.
            const userData = await apiFetch('/auth/me');
            if (userData) {
                const normalized = normalizeClientData(userData);
                setCurrentClient(normalized);

                // Fetch data based on role
                if (normalized.role === Role.Admin) {
                    const [allClients, allBets, allTransactions, marketData] = await Promise.all([
                        apiFetch('/admin/clients'),
                        apiFetch('/admin/bets'),
                        apiFetch('/admin/transactions'),
                        apiFetch('/admin/market-override'),
                    ]);
                    setClients(allClients.map(normalizeClientData));
                    setBets(allBets.map((b: any) => ({...b, stake: Number(b.stake), createdAt: new Date(b.createdAt)})));
                    setTransactions(allTransactions.map((t: any) => ({...t, amount: Number(t.amount), balanceAfter: Number(t.balanceAfter), createdAt: new Date(t.createdAt), isReversed: !!t.isReversed })));
                    setMarketOverrideState(marketData.override);
                } else {
                    const [clientBets, clientTransactions] = await Promise.all([
                        apiFetch('/client/bets'),
                        apiFetch('/client/transactions')
                    ]);
                    setClients([]); // Clients don't see other clients
                    setBets(clientBets.map((b: any) => ({...b, stake: Number(b.stake), createdAt: new Date(b.createdAt)})));
                    setTransactions(clientTransactions.map((t: any) => ({...t, amount: Number(t.amount), balanceAfter: Number(t.balanceAfter), createdAt: new Date(t.createdAt), isReversed: !!t.isReversed })));
                }
            } else {
                 await logout(); // Token is invalid
            }
        } catch (error) {
            console.error("Failed to fetch user data, logging out.", error);
            await logout();
        }
    }, []);

    // Initial load and draw polling
    useEffect(() => {
        const pollData = async () => {
            try {
                // Clear any previous error on a new attempt
                if(error) setError(null);

                const drawsData = await apiFetch('/draws');
                setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
                await fetchDataForUser();

                // Schedule the next poll only on success
                pollingTimeoutRef.current = window.setTimeout(pollData, 15000);
            } catch (err) {
                console.error("Data polling failed:", err);
                setError("Could not connect to the server. Please ensure the backend server is running and accessible.");
                // Stop polling on error
            } finally {
                // This ensures the initial "Loading..." message is removed
                if (isLoading) {
                    setIsLoading(false);
                }
            }
        };

        pollData(); // Start the polling loop

        // Cleanup function to clear the timeout when the component unmounts
        return () => {
            if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchDataForUser]); // We only want this effect to run once on mount

    const login = useCallback(async (loginIdentifier: string, password: string, role: Role): Promise<{ success: boolean; message?: string }> => {
        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ loginIdentifier, password, role }),
            });
            localStorage.setItem('ddl_token', data.token);
            await fetchDataForUser(); // Fetch all data for the newly logged-in user
            // Re-fetch draws to ensure status is fresh on login
             const drawsData = await apiFetch('/draws');
             setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, [fetchDataForUser]);

    const logout = useCallback(async () => {
        localStorage.removeItem('ddl_token');
        setCurrentClient(null);
        setClients([]);
        setBets([]);
        setTransactions([]);
    }, []);
    
    const placeBulkBetsForCurrentClient = useCallback(async (betsToPlace: Omit<Bet, 'id' | 'clientId'>[]): Promise<{ successCount: number; message: string; }> => {
        if (!currentClient || currentClient.role !== Role.Client) {
            return { successCount: 0, message: "This feature is for clients only." };
        }
        try {
            const result = await apiFetch('/client/bets', {
                method: 'POST',
                body: JSON.stringify({ bets: betsToPlace }),
            });
            // Refresh user data to get new wallet balance and transactions
            await fetchDataForUser();
            return { successCount: result.successCount, message: result.message };
        } catch (error: any) {
             return { successCount: 0, message: error.message };
        }
    }, [currentClient, fetchDataForUser]);
    
    const setDeclaredNumbers = useCallback(async (drawId: string, winningNumbers: string[]): Promise<void> => {
        try {
            await apiFetch(`/admin/draws/${drawId}/declared-numbers`, {
                method: 'PUT',
                body: JSON.stringify({ winningNumbers }),
            });
            const drawsData = await apiFetch('/draws');
            setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
            alert(`Declared numbers for draw ${drawId} updated successfully!`);
        } catch (error: any) {
            alert(`Failed to set declared numbers: ${error.message}`);
        }
    }, []);

    const declareWinner = useCallback(async (drawId: string, winningNumbers: string[]): Promise<void> => {
         try {
            await apiFetch(`/admin/draws/${drawId}/declare-winner`, {
                method: 'POST',
                body: JSON.stringify({ winningNumbers }),
            });
            // Refresh all data
            const drawsData = await apiFetch('/draws');
            setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
            await fetchDataForUser();
            alert(`Winners for draw ${drawId} declared successfully!`);
        } catch (error: any) {
            alert(`Failed to declare winner: ${error.message}`);
        }
    }, [fetchDataForUser]);
    
    const registerClient = useCallback(async (clientData: Omit<Client, 'id' | 'role' | 'isActive'>): Promise<{ success: boolean, message: string }> => {
        try {
            const newClient = await apiFetch('/admin/clients', {
                method: 'POST',
                body: JSON.stringify(clientData),
            });
            setClients(prev => [...prev, normalizeClientData(newClient)]);
            return { success: true, message: 'Client registered successfully.' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, []);
    
    const adjustClientWallet = useCallback(async (clientId: string, amount: number, type: TransactionType, description: string): Promise<{ success: boolean, message: string }> => {
        try {
            const updatedClient = await apiFetch(`/admin/clients/${clientId}/wallet`, {
                method: 'POST',
                body: JSON.stringify({ amount, type, description }),
            });
            setClients(prev => prev.map(c => c.id === clientId ? normalizeClientData(updatedClient) : c));
             // If the admin is adjusting their own client's wallet, update currentClient too
            if (currentClient?.id === clientId) {
                setCurrentClient(normalizeClientData(updatedClient));
            }
            await fetchDataForUser(); // to get latest transactions
            return { success: true, message: 'Wallet updated successfully.' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, [currentClient, fetchDataForUser]);
    
    const updateClientDetailsByAdmin = useCallback(async (clientId: string, details: { clientId?: string; username?: string; contact?: string; area?: string; }): Promise<{ success: boolean, message: string }> => {
         try {
            const updatedClient = await apiFetch(`/admin/clients/${clientId}`, {
                method: 'PUT',
                body: JSON.stringify(details),
            });
            setClients(prev => prev.map(c => c.id === clientId ? normalizeClientData(updatedClient) : c));
            return { success: true, message: 'Client details updated successfully.' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, []);

    const changeClientPasswordByAdmin = useCallback(async (clientId: string, newPassword: string, callback: (result: { success: boolean, message: string }) => void): Promise<void> => {
        try {
            await apiFetch(`/admin/clients/${clientId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ newPassword }),
            });
            callback({ success: true, message: 'Password updated successfully.' });
        } catch (error: any) {
            callback({ success: false, message: error.message });
        }
    }, []);

    const updateClientCredentials = useCallback(async (data: { currentPassword: string, newUsername?: string, newPassword?: string }) => {
        if (!currentClient) {
            return { success: false, message: 'No user is currently logged in.' };
        }

        // Determine the correct API endpoint based on the user's role to ensure
        // admins and clients update their credentials via separate, secure routes.
        const apiPath = currentClient.role === Role.Admin
            ? '/admin/profile/credentials'
            : '/client/credentials';
            
        try {
            const updatedUser = await apiFetch(apiPath, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            setCurrentClient(normalizeClientData(updatedUser));
            return { success: true, message: 'Credentials updated successfully.' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, [currentClient]);

    const placeBetsForClient = useCallback(async (betsToPlace: Omit<Bet, 'id' | 'clientId'>[], clientId: string): Promise<{ successCount: number; message: string; }> => {
        try {
            const result = await apiFetch(`/admin/bets`, {
                method: 'POST',
                body: JSON.stringify({ bets: betsToPlace, clientId }),
            });
            await fetchDataForUser(); // Refresh data for admin
            return { successCount: result.successCount, message: result.message };
        } catch (error: any) {
            return { successCount: 0, message: error.message };
        }
    }, [fetchDataForUser]);
    
    const getDrawStats = useCallback(async (drawId: string): Promise<any> => {
        return apiFetch(`/admin/reports/draw/${drawId}`);
    }, []);
    
    const getLiveDrawAnalysis = useCallback(async (drawId: string): Promise<any> => {
        return apiFetch(`/admin/reports/live/${drawId}`);
    }, []);
    
    const updateClient = useCallback(async (updatedClient: Client): Promise<void> => {
        try {
            const result = await apiFetch(`/admin/clients/${updatedClient.id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedClient),
            });
            setClients(prev => prev.map(c => c.id === updatedClient.id ? normalizeClientData(result) : c));
        } catch (error: any) {
             console.error("Failed to update client:", error.message);
        }
    }, []);

    const updateDrawTime = useCallback(async (drawId: string, newTime: Date) => {
        try {
            await apiFetch(`/admin/draws/${drawId}/time`, {
                method: 'PUT',
                body: JSON.stringify({ newTime: newTime.toISOString() }),
            });
            // Re-fetch draws to show the update
            const drawsData = await apiFetch('/draws');
            setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
            alert('Draw time updated successfully.');
        } catch (error: any) {
            alert(`Failed to update draw time: ${error.message}`);
        }
    }, []);

    const shiftAllDrawTimes = useCallback(async (minutes: number) => {
        try {
            await apiFetch('/admin/draws/shift-all', {
                method: 'POST',
                body: JSON.stringify({ minutes }),
            });
            // Re-fetch draws
            const drawsData = await apiFetch('/draws');
            setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
            alert('All draw times shifted successfully.');
        } catch (error: any) {
            alert(`Failed to shift draw times: ${error.message}`);
        }
    }, []);


    const setMarketOverride = useCallback(async (override: MarketOverride) => {
        try {
            await apiFetch('/admin/market-override', {
                method: 'POST',
                body: JSON.stringify({ override }),
            });
            setMarketOverrideState(override);
            // Re-fetch draws immediately to show the status changes
            const drawsData = await apiFetch('/draws');
            setDraws(drawsData.map((d: Draw) => ({ ...d, drawTime: new Date(d.drawTime) })));
        } catch (error: any) {
            alert(`Failed to set market override: ${error.message}`);
        }
    }, []);
    
    const reverseWinningTransaction = useCallback(async (transactionId: string): Promise<{ success: boolean, message: string }> => {
        try {
            await apiFetch(`/admin/transactions/${transactionId}/reverse`, {
                method: 'POST',
            });
            await fetchDataForUser(); // Refresh all data to reflect changes
            return { success: true, message: 'Transaction reversed successfully.' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }, [fetchDataForUser]);

    // The following functions are not yet implemented in the backend in this pass.
    const toggleDrawStatus = async (drawId: string) => { console.warn("toggleDrawStatus not implemented"); };
    const importClientsFromCSV = async (clientsData: ClientImportData[]) => { console.warn("importClientsFromCSV not implemented"); return { successCount: 0, errorCount: clientsData.length, errorMessages: ["Not implemented"] }; };

    const placeBet = useCallback(async (bet: Omit<Bet, 'id' | 'clientId'>): Promise<{ success: boolean; message: string }> => {
        const result = await placeBulkBetsForCurrentClient([bet]);
        return {
            success: result.successCount > 0,
            message: result.message,
        };
    }, [placeBulkBetsForCurrentClient]);

    const value: AppContextType = useMemo(() => ({
        currentClient, clients, draws, bets, transactions, marketOverride,
        login, logout, setMarketOverride, placeBulkBetsForCurrentClient,
        declareWinner, registerClient, adjustClientWallet, updateClientDetailsByAdmin,
        changeClientPasswordByAdmin, toggleDrawStatus, updateClientCredentials,
        getDrawStats, getLiveDrawAnalysis, importClientsFromCSV,
        placeBetsForClient, updateDrawTime, shiftAllDrawTimes,
        updateClient,
        placeBet,
        setDeclaredNumbers,
        reverseWinningTransaction,
    }), [
        currentClient, clients, draws, bets, transactions, marketOverride,
        login, logout, placeBulkBetsForCurrentClient,
        declareWinner, registerClient, adjustClientWallet, updateClientDetailsByAdmin,
        changeClientPasswordByAdmin, updateClientCredentials,
        getDrawStats, getLiveDrawAnalysis,
        placeBetsForClient, updateDrawTime, shiftAllDrawTimes,
        updateClient, placeBet, setDeclaredNumbers, setMarketOverride, reverseWinningTransaction
    ]);

    if (isLoading) {
        return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-primary text-xl">Loading Application...</div>;
    }
    
    if (error && !currentClient) {
        return (
           <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text p-4">
               <div className="bg-brand-surface p-8 rounded-lg border border-danger max-w-lg text-center shadow-lg animate-fade-in-down">
                   <h1 className="text-2xl font-bold text-danger mb-4">Connection Error</h1>
                   <p className="mb-4">{error}</p>
                   <p className="text-sm text-brand-text-secondary">Please try refreshing the page after ensuring the backend server is running.</p>
               </div>
           </div>
       );
   }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};