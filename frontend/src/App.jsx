import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InspectionApp from './pages/villa/InspectionApp.jsx';
import WVAuditPro from './pages/wv/WVAuditPro.jsx';
import VeloraApp from './pages/velora/VeloraApp.jsx';
import ApartmentAudit from './pages/apartment/ApartmentAudit.jsx';
import AdminPortal from './pages/admin/AdminPortal.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/villa"
        element={
          <ProtectedRoute module="villa">
            <InspectionApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wv"
        element={
          <ProtectedRoute module="wv">
            <WVAuditPro />
          </ProtectedRoute>
        }
      />
      <Route
        path="/velora"
        element={
          <ProtectedRoute module="velora">
            <VeloraApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apartment"
        element={
          <ProtectedRoute module="apartment">
            <ApartmentAudit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPortal />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
