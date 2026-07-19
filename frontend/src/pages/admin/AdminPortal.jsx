import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { api, errorMessage } from '../../api/client.js';
import NetworkStatus from '../../components/NetworkStatus.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [audits, setAudits] = useState([]);
  const [veloraAudits, setVeloraAudits] = useState([]);
  const [serviceReports, setServiceReports] = useState([]);
  const [complianceDeliveries, setComplianceDeliveries] = useState([]);
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState(null);
  
  // Direct password reset modal state
  const [resetPasswordModal, setResetPasswordModal] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Edit user details modal state
  const [editUserModal, setEditUserModal] = useState(null);

  // Global Audits sub-tab
  const [auditSubTab, setAuditSubTab] = useState('villa');

  // Database maintenance state
  const [purgeModule, setPurgeModule] = useState('villa');

  // Password confirmation modal state for destructive actions
  const [passwordConfirmModal, setPasswordConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    password: '',
    error: '',
    onConfirm: null
  });

  // New user form state
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'AUDITOR', name: '', idNumber: '' });
  const [formError, setFormError] = useState('');

  // Protect route
  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'audits') fetchAudits();
    else if (activeTab === 'resets') fetchResets();
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data.data.users);
    } catch (e) {
      show('Failed to fetch users.', 'error');
    }
    setLoading(false);
  };

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/audits');
      setAudits(res.data.data.audits || []);
      setVeloraAudits(res.data.data.veloraAudits || []);
      setServiceReports(res.data.data.serviceReports || []);
      setComplianceDeliveries(res.data.data.complianceDeliveries || []);
    } catch (e) {
      show('Failed to fetch global records.', 'error');
    }
    setLoading(false);
  };

  const fetchResets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/resets');
      setResets(res.data.data.requests);
    } catch (e) {
      show('Failed to fetch reset requests.', 'error');
    }
    setLoading(false);
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      await api.put(`/api/admin/users/${id}/status`, { isActive: !currentStatus });
      show('User status updated successfully.', 'success');
      fetchUsers();
    } catch (e) {
      show(errorMessage(e, 'Failed to toggle status'), 'error');
    }
  };

  const handleUpdateUserRole = async (id, role) => {
    try {
      await api.put(`/api/admin/users/${id}/role`, { role });
      show('User role updated successfully.', 'success');
      fetchUsers();
    } catch (e) {
      show(errorMessage(e, 'Failed to update user role'), 'error');
    }
  };

  const handleDirectResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordModal) return;
    try {
      await api.put(`/api/admin/users/${resetPasswordModal.id}/password`, { password: newPasswordVal });
      setResetPasswordModal(null);
      setNewPasswordVal('');
      show('Password updated successfully.', 'success');
    } catch (e) {
      show(errorMessage(e, 'Failed to reset password'), 'error');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editUserModal) return;
    try {
      await api.put(`/api/admin/users/${editUserModal.id}`, {
        username: editUserModal.username,
        name: editUserModal.name,
        idNumber: editUserModal.idNumber
      });
      setEditUserModal(null);
      show('User details updated successfully.', 'success');
      fetchUsers();
    } catch (e) {
      show(errorMessage(e, 'Failed to update user'), 'error');
    }
  };

  const handleDeleteUser = async (id, username) => {
    const performDelete = async (confirmPassword) => {
      try {
        await api.delete(`/api/admin/users/${id}`, { data: { confirmPassword } });
        show(`User ${username} deleted successfully.`, 'success');
        fetchUsers();
        setPasswordConfirmModal({ isOpen: false, title: '', message: '', password: '', error: '', onConfirm: null });
      } catch (e) {
        if (user?.role === 'SUPERADMIN') {
          setPasswordConfirmModal(prev => ({ ...prev, error: errorMessage(e, 'Verification failed.') }));
        } else {
          show(errorMessage(e, 'Failed to delete user'), 'error');
        }
      }
    };

    if (user?.role === 'SUPERADMIN') {
      setPasswordConfirmModal({
        isOpen: true,
        title: `Delete User ${username}`,
        message: `Warning: This will permanently delete user account ${username} and all their session/draft history. Please verify your superadmin password to confirm.`,
        password: '',
        error: '',
        onConfirm: performDelete
      });
    } else {
      if (!(await confirm(`Are you sure you want to delete user ${username}? All their sessions and drafts will be removed permanently.`))) return;
      performDelete();
    }
  };

  const handlePurgeUsers = async () => {
    const performPurge = async (confirmPassword) => {
      try {
        const res = await api.delete('/api/admin/maintenance/users', { data: { confirmPassword } });
        show(res.data.message || 'Users purged successfully.', 'success');
        fetchUsers();
        setPasswordConfirmModal({ isOpen: false, title: '', message: '', password: '', error: '', onConfirm: null });
      } catch (e) {
        setPasswordConfirmModal(prev => ({ ...prev, error: errorMessage(e, 'Verification failed.') }));
      }
    };

    setPasswordConfirmModal({
      isOpen: true,
      title: 'Purge All Users',
      message: 'CRITICAL WARNING: This will permanently delete ALL registered users in the database, except for your currently active Superadmin account. Please verify your superadmin password to confirm.',
      password: '',
      error: '',
      onConfirm: performPurge
    });
  };

  const handlePurgeAllRecords = async () => {
    const performPurge = async (confirmPassword) => {
      try {
        const res = await api.delete('/api/admin/maintenance/all-records', { data: { confirmPassword } });
        show(res.data.message || 'All database records purged successfully.', 'success');
        setPasswordConfirmModal({ isOpen: false, title: '', message: '', password: '', error: '', onConfirm: null });
      } catch (e) {
        setPasswordConfirmModal(prev => ({ ...prev, error: errorMessage(e, 'Verification failed.') }));
      }
    };

    setPasswordConfirmModal({
      isOpen: true,
      title: 'Purge All Inspection Records',
      message: 'CRITICAL WARNING: This will permanently delete ALL inspection and audit records across ALL modules (Villa, Workers Village, Velora, Compliance). Please verify your superadmin password to confirm.',
      password: '',
      error: '',
      onConfirm: performPurge
    });
  };

  const handlePurgeModule = async () => {
    const performPurge = async (confirmPassword) => {
      try {
        const res = await api.delete(`/api/admin/maintenance/module/${purgeModule}`, { data: { confirmPassword } });
        show(res.data.message || 'Module records purged successfully.', 'success');
        setPasswordConfirmModal({ isOpen: false, title: '', message: '', password: '', error: '', onConfirm: null });
      } catch (e) {
        setPasswordConfirmModal(prev => ({ ...prev, error: errorMessage(e, 'Verification failed.') }));
      }
    };

    setPasswordConfirmModal({
      isOpen: true,
      title: `Purge ${purgeModule} Records`,
      message: `Warning: This will permanently wipe and delete all records for the module: ${purgeModule}. Please verify your superadmin password to confirm.`,
      password: '',
      error: '',
      onConfirm: performPurge
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/api/admin/users', newUser);
      show('User created successfully.', 'success');
      setNewUser({ username: '', password: '', role: 'AUDITOR', name: '', idNumber: '' });
      fetchUsers();
    } catch (e) {
      const errText = errorMessage(e, 'Failed to create user');
      setFormError(errText);
      show(errText, 'error');
    }
  };

  const handleApproveReset = async (id) => {
    try {
      const res = await api.post(`/api/admin/resets/${id}/approve`);
      setTempPasswordModal({
        username: res.data.data.username,
        password: res.data.data.tempPassword
      });
      fetchResets();
    } catch (e) {
      show(errorMessage(e, 'Failed to approve reset'), 'error');
    }
  };

  const handleDeleteVillaAudit = async (auditCode) => {
    if (!(await confirm('Are you sure you want to delete this Villa inspection? This action is permanent.'))) return;
    try {
      await api.delete(`/api/villa/reports/${auditCode}`);
      show('Inspection deleted successfully.', 'success');
      fetchAudits();
    } catch (e) {
      show('Failed to delete inspection.', 'error');
    }
  };

  const handleDeleteVeloraAudit = async (id) => {
    if (!(await confirm('Are you sure you want to delete this Velora audit? This action is permanent.'))) return;
    try {
      await api.delete(`/api/admin/velora-audits/${id}`);
      show('Velora audit deleted successfully.', 'success');
      fetchAudits();
    } catch (e) {
      show('Failed to delete Velora audit.', 'error');
    }
  };

  const handleDeleteServiceReport = async (id) => {
    if (!(await confirm('Are you sure you want to delete this Service Report? This action is permanent.'))) return;
    try {
      await api.delete(`/api/admin/service-reports/${id}`);
      show('Service report deleted successfully.', 'success');
      fetchAudits();
    } catch (e) {
      show('Failed to delete Service Report.', 'error');
    }
  };

  const handleDeleteCompliance = async (id) => {
    if (!(await confirm('Are you sure you want to delete this Compliance record? This action is permanent.'))) return;
    try {
      await api.delete(`/api/admin/compliance-deliveries/${id}`);
      show('Compliance record deleted successfully.', 'success');
      fetchAudits();
    } catch (e) {
      show('Failed to delete Compliance record.', 'error');
    }
  };

  if (user?.role !== 'SUPERADMIN' && user?.role !== 'ADMIN') return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div>
            <h1>{user?.role === 'SUPERADMIN' ? 'SUPERADMIN DASHBOARD' : 'ADMIN DASHBOARD'}</h1>
            <p>{user?.role === 'SUPERADMIN' ? 'System oversight' : 'Oversight & Inspection Management'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NetworkStatus />
          <ThemeToggle />
          <span className="status-badge">{user?.username} · {user?.role === 'SUPERADMIN' ? 'Superadmin' : 'Admin'}</span>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Dashboard</button>
          <button className="btn-danger-outline" onClick={logout} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Logout</button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>User Management</button>
        {user?.role === 'SUPERADMIN' && (
          <button className={`tab ${activeTab === 'resets' ? 'active' : ''}`} onClick={() => setActiveTab('resets')}>Password Resets</button>
        )}
        {user?.role === 'ADMIN' && (
          <button className={`tab ${activeTab === 'audits' ? 'active' : ''}`} onClick={() => setActiveTab('audits')}>Global Inspections</button>
        )}
        {user?.role === 'SUPERADMIN' && (
          <button className={`tab ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveTab('maintenance')}>Maintenance Tools</button>
        )}
      </div>

      <main className="main-content">
        {loading && (
          <div className="card">
            <ListSkeleton rows={5} />
          </div>
        )}

        {activeTab === 'users' && !loading && (
          <div className="card">
            <h2 className="card-title">Manage Users</h2>
            
            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <h3>Add New User</h3>
              {formError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: '0.5rem 0' }}>{formError}</p>}
              <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <input 
                  className="input-field" 
                  placeholder="Full Name" 
                  value={newUser.name} 
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  required 
                />
                <input 
                  className="input-field" 
                  placeholder="ID Number" 
                  value={newUser.idNumber} 
                  onChange={e => setNewUser({...newUser, idNumber: e.target.value})}
                  required 
                />
                <input 
                  className="input-field" 
                  placeholder="Username" 
                  value={newUser.username} 
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  required 
                />
                <input 
                  className="input-field" 
                  placeholder="Password" 
                  type="password"
                  value={newUser.password} 
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  required 
                />
                <select 
                  className="input-field" 
                  value={newUser.role} 
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  style={{ minWidth: '150px' }}
                >
                  <option value="AUDITOR">Auditor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button type="submit" className="btn-primary">Create User</button>
              </form>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Username</th>
                  <th style={{ padding: '0.5rem' }}>ID Number</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{u.name || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{u.username}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{u.idNumber || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <select 
                        className="input-field"
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                        disabled={user.id === u.id}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto', display: 'inline-block' }}
                      >
                        <option value="AUDITOR">Auditor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {u.isActive ? (
                        <span style={{ color: 'var(--green)', fontWeight: '500' }}>Active</span>
                      ) : (
                        <span style={{ color: 'var(--red)', fontWeight: '500' }}>Suspended</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button 
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => setEditUserModal(u)}
                        >
                          Edit Details
                        </button>
                        {user?.role === 'SUPERADMIN' && (
                          <button 
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setResetPasswordModal(u)}
                          >
                            Reset Password
                          </button>
                        )}
                        {user.id !== u.id && (
                          <>
                            <button 
                              className={u.isActive ? "btn-danger-outline" : "btn-secondary"} 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => toggleUserStatus(u.id, u.isActive)}
                            >
                              {u.isActive ? 'Suspend' : 'Activate'}
                            </button>
                            {(user?.role === 'SUPERADMIN' || u.role === 'AUDITOR') && (
                              <button 
                                className="btn-danger-outline"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: '1px solid var(--danger-border)' }}
                                onClick={() => handleDeleteUser(u.id, u.username)}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'resets' && !loading && (
          <div className="card">
            <h2 className="card-title">Pending Password Resets</h2>
            {resets.length === 0 ? (
              <p style={{ color: 'var(--gray)' }}>No pending reset requests.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>User</th>
                    <th style={{ padding: '0.5rem' }}>Requested At</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {resets.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{r.user.username}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gray)', fontSize: '0.9rem' }}>
                        {new Date(r.requestedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => handleApproveReset(r.id)}
                        >
                          Approve & Generate Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'audits' && !loading && (
          <div className="card">
            <h2 className="card-title">Global Inspections</h2>
            
            <div style={{ background: 'var(--zinc-50)', padding: '6px', borderRadius: 'var(--radius)', display: 'flex', gap: '8px', marginBottom: '20px', border: '1px solid var(--zinc-200)', flexWrap: 'wrap' }}>
              <button 
                className={`tab ${auditSubTab === 'villa' ? 'active' : ''}`} 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }} 
                onClick={() => setAuditSubTab('villa')}
              >
                Villa &amp; WV Inspections
              </button>
              <button 
                className={`tab ${auditSubTab === 'velora' ? 'active' : ''}`} 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }} 
                onClick={() => setAuditSubTab('velora')}
              >
                Velora Performance Audits
              </button>
              <button 
                className={`tab ${auditSubTab === 'service-reports' ? 'active' : ''}`} 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }} 
                onClick={() => setAuditSubTab('service-reports')}
              >
                Velora Service Reports
              </button>
              <button 
                className={`tab ${auditSubTab === 'compliance' ? 'active' : ''}`} 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }} 
                onClick={() => setAuditSubTab('compliance')}
              >
                Velora Compliance Records
              </button>
            </div>

            {auditSubTab === 'villa' && (
              <div>
                {audits.length === 0 ? (
                  <p style={{ color: 'var(--gray)' }}>No inspections found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Audit Ref</th>
                        <th style={{ padding: '0.5rem' }}>Property</th>
                        <th style={{ padding: '0.5rem' }}>Auditor</th>
                        <th style={{ padding: '0.5rem' }}>Issues</th>
                        <th style={{ padding: '0.5rem' }}>Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{a.auditCode}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{a.villa?.propertyNumber}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{a.auditor?.username || 'Unknown'}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{a.issueCount}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gray)', fontSize: '0.9rem' }}>
                            {new Date(a.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <button 
                              className="btn-danger-outline" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                              onClick={() => handleDeleteVillaAudit(a.auditCode)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {auditSubTab === 'velora' && (
              <div>
                {veloraAudits.length === 0 ? (
                  <p style={{ color: 'var(--gray)' }}>No Velora audits found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Audit Number</th>
                        <th style={{ padding: '0.5rem' }}>Category</th>
                        <th style={{ padding: '0.5rem' }}>Auditor</th>
                        <th style={{ padding: '0.5rem' }}>Score</th>
                        <th style={{ padding: '0.5rem' }}>Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {veloraAudits.map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{v.auditNumber}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{v.serviceCategory}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{v.auditorName || v.auditor?.username || 'Unknown'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{v.overallScore ? `${v.overallScore}%` : '-'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gray)', fontSize: '0.9rem' }}>
                            {new Date(v.auditDate).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <button 
                              className="btn-danger-outline" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                              onClick={() => handleDeleteVeloraAudit(v.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {auditSubTab === 'service-reports' && (
              <div>
                {serviceReports.length === 0 ? (
                  <p style={{ color: 'var(--gray)' }}>No Service Reports found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Report Number</th>
                        <th style={{ padding: '0.5rem' }}>Title</th>
                        <th style={{ padding: '0.5rem' }}>Created By</th>
                        <th style={{ padding: '0.5rem' }}>Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceReports.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{s.reportNumber}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{s.title}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{s.createdBy || 'System'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gray)', fontSize: '0.9rem' }}>
                            {new Date(s.reportDate).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <button 
                              className="btn-danger-outline" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                              onClick={() => handleDeleteServiceReport(s.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {auditSubTab === 'compliance' && (
              <div>
                {complianceDeliveries.length === 0 ? (
                  <p style={{ color: 'var(--gray)' }}>No Compliance records found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Item</th>
                        <th style={{ padding: '0.5rem' }}>Category</th>
                        <th style={{ padding: '0.5rem' }}>Delivery Date</th>
                        <th style={{ padding: '0.5rem' }}>Status</th>
                        <th style={{ padding: '0.5rem' }}>Verified By</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceDeliveries.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{c.item_name}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{c.category_name}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(c.deliveryDate).toLocaleDateString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span className="status-badge" style={{ background: c.status === 'compliant' ? 'var(--ok-bg)' : c.status === 'partial' ? 'var(--warn-bg)' : 'var(--danger-bg)', color: c.status === 'compliant' ? 'var(--ok-fg)' : c.status === 'partial' ? 'var(--warn-fg)' : 'var(--danger-fg)' }}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{c.verifiedBy || '-'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <button 
                              className="btn-danger-outline" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                              onClick={() => handleDeleteCompliance(c.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && user?.role === 'SUPERADMIN' && (
          <div className="card">
            <h2 className="card-title" style={{ color: 'var(--danger)' }}>Database Maintenance Tools</h2>
            <p style={{ color: 'var(--gray)', marginBottom: '2rem' }}>
              Warning: These tools are permanent and destructive. Only superadmins have access to perform these purges.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div className="card" style={{ border: '1px solid var(--danger-bg)', background: '#fff5f5' }}>
                <h3 style={{ color: 'var(--danger-fg)', marginBottom: '0.5rem' }}>Purge Users</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '1.5rem' }}>
                  Deletes all registered users in the database, except for your currently active Superadmin account.
                </p>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', justifyContent: 'center' }}
                  onClick={handlePurgeUsers}
                >
                  Purge All Users
                </button>
              </div>

              <div className="card" style={{ border: '1px solid var(--danger-bg)', background: '#fff5f5' }}>
                <h3 style={{ color: 'var(--danger-fg)', marginBottom: '0.5rem' }}>Purge All Inspection Records</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '1.5rem' }}>
                  Deletes all inspection records, audits, service reports, and compliance records across all modules.
                </p>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', justifyContent: 'center' }}
                  onClick={handlePurgeAllRecords}
                >
                  Purge All Records
                </button>
              </div>

              <div className="card" style={{ border: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Purge Module Records</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '1.5rem' }}>
                  Select a specific module to wipe and delete all its audits/reports.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select 
                    className="input-field"
                    value={purgeModule}
                    onChange={(e) => setPurgeModule(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="villa">Villa & Workers Village</option>
                    <option value="velora-audits">Velora Audits</option>
                    <option value="service-reports">Velora Service Reports</option>
                    <option value="compliance">Velora Compliance Records</option>
                  </select>
                  <button 
                    className="btn-danger-outline"
                    onClick={handlePurgeModule}
                  >
                    Purge Module
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {tempPasswordModal && (
        <div className="modal">
          <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--green)', marginBottom: '1rem' }}>Reset Approved!</h2>
            <p style={{ marginBottom: '1rem' }}>Please securely share this temporary password with <strong>{tempPasswordModal.username}</strong>.</p>
            <div style={{ background: 'var(--zinc-100)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '1.5rem', letterSpacing: '2px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              {tempPasswordModal.password}
            </div>
            <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Warning: This password is only shown once. If lost, you must generate a new one.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTempPasswordModal(null)}>
                Done
              </button>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => {
                  const msg = `Hi ${tempPasswordModal.username}, your password has been reset. Username: ${tempPasswordModal.username} | Temporary Password: ${tempPasswordModal.password}. Please sign in and update your password.`;
                  navigator.clipboard.writeText(msg);
                  show('Reset message copied to clipboard!', 'success');
                }}
              >
                Copy Message
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordModal && (
        <div className="modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '20px', borderRadius: 'var(--radius)', background: 'var(--white)' }}>
            <h2>Reset Password for {resetPasswordModal.username}</h2>
            <form onSubmit={handleDirectResetPassword} style={{ marginTop: '15px' }}>
              <input
                className="input-field"
                type="password"
                placeholder="New Password (min 6 characters)"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                required
                style={{ width: '100%', marginBottom: '15px' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => { setResetPasswordModal(null); setNewPasswordVal(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordConfirmModal.isOpen && (
        <div className="modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '450px', width: '90%', padding: '24px', borderRadius: 'var(--radius)', background: 'var(--white)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <h2 style={{ color: 'var(--danger)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              Security Verification
            </h2>
            <p style={{ margin: '1rem 0', color: 'var(--zinc-600)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              {passwordConfirmModal.message}
            </p>
            {passwordConfirmModal.error && (
              <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '500' }}>
                {passwordConfirmModal.error}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              passwordConfirmModal.onConfirm(passwordConfirmModal.password);
            }}>
              <input
                className="input-field"
                type="password"
                placeholder="Enter your superadmin password"
                value={passwordConfirmModal.password}
                onChange={(e) => setPasswordConfirmModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
                required
                autoFocus
                style={{ width: '100%', marginBottom: '1.25rem' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setPasswordConfirmModal({ isOpen: false, title: '', message: '', password: '', error: '', onConfirm: null })}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}>
                  Verify & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUserModal && (
        <div className="modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '20px', borderRadius: 'var(--radius)', background: 'var(--white)' }}>
            <h2>Edit User Details</h2>
            <form onSubmit={handleEditUser} style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--zinc-500)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Full Name"
                  value={editUserModal.name || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, name: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--zinc-500)', display: 'block', marginBottom: '4px' }}>Username</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Username"
                  value={editUserModal.username || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, username: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--zinc-500)', display: 'block', marginBottom: '4px' }}>ID Number</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="ID Number"
                  value={editUserModal.idNumber || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, idNumber: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditUserModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


