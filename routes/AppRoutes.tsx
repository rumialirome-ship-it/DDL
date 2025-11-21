import React from 'react';
// FIX: The named imports for Routes, Route, and Navigate were failing. Using a namespace import as a workaround for a potential build tool or module resolution issue.
import * as ReactRouterDom from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext.tsx';
import * as LandingPageModule from '../pages/LandingPage.tsx';
const LandingPage = LandingPageModule.default;
import * as LoginModule from '../components/auth/Login.tsx';
const Login = LoginModule.default;
import * as DashboardModule from '../pages/Dashboard.tsx';
const Dashboard = DashboardModule.default;

const AppRoutes = () => {
    const { currentClient } = useAppContext();
    return (
        <ReactRouterDom.Routes>
            <ReactRouterDom.Route path="/" element={currentClient ? <ReactRouterDom.Navigate to="/dashboard" /> : <LandingPage />} />
            <ReactRouterDom.Route path="/login" element={currentClient ? <ReactRouterDom.Navigate to="/dashboard" /> : <Login />} />
            <ReactRouterDom.Route path="/dashboard" element={currentClient ? <Dashboard /> : <ReactRouterDom.Navigate to="/login" />} />
            <ReactRouterDom.Route path="*" element={<ReactRouterDom.Navigate to="/" />} />
        </ReactRouterDom.Routes>
    );
};

export default AppRoutes;