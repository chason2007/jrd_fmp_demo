import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import NetworkStatus from '../../components/NetworkStatus.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';
import { api } from '../../api/client.js';
import { jsPDF } from 'jspdf';
import { useAutosave } from '../../hooks/useAutosave.js';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import { newLocalId, listOfflineDrafts, deleteOfflineDraft, syncOfflineDrafts } from '../../lib/offlineDrafts.js';
import './VeloraApp.css';

// Push one device-held Velora draft up to the server (used by the reconnect sync).
// Mirrors the field mapping the autosave POST uses.
async function pushVeloraDraft(payload, record) {
  const p = payload || {};
  await api.post('/api/velora/drafts', {
    draftId: record?.serverId || undefined,
    serviceTypeId: p.serviceTypeId ? parseInt(p.serviceTypeId, 10) : undefined,
    serviceCategory: p.serviceCategory,
    auditDate: p.auditDate,
    auditorName: p.auditorName,
    locations: p.selectedLocations,
    responses: p.auditResponses,
  });
}
import {
  LayoutDashboard,
  ClipboardList,
  Save,
  FileText,
  ShieldCheck,
  Building,
  Calendar,
  User,
  MapPin,
  Camera,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  LogOut,
  ChevronRight,
} from 'lucide-react';

// Location Data Structures
const airportLocations = {
  "Ground Level": { "Core Building": { "Landside": [{ roomNumber: "RM.L0.2.030-LS", roomName: "Baggage Tracing Office & Store Room" }, { roomNumber: "RM.L0.2.049-LS", roomName: "Central Store Room" }, { roomNumber: "RM.L0.2.053-LS", roomName: "Break Room" }] } },
  "Level 1": { "Core Building": { "Landside": [{ roomNumber: "RM.L1.1.128-LS", roomName: "BOH (Laundry Room)" }] } },
  "Level 2": { "Core Building": { "Airside": [{ roomNumber: "RM.L2.2.033-AS", roomName: "Break Room - 5" }, { roomNumber: "RM.L2.3.049-AS", roomName: "Baggage Operations Office" }, { roomNumber: "RM.L2.3.052-AS", roomName: "Baggage Operations Control Centre" }, { roomNumber: "RM.L2.3.054-AS", roomName: "Break Room - 6" }, { roomNumber: "RM.L2.5.029-AS", roomName: "Break Room -3" }, { roomNumber: "RM.L2.5.030-AS", roomName: "Locker & Briefing Room" }] }, "Pier B": { "Airside": [{ roomNumber: "RM.L2.B1.003-AS", roomName: "National Service Office" }, { roomNumber: "RM.L2.B1.004-AS", roomName: "Training Room - Fujairah" }, { roomNumber: "RM.L2.B1.017-AS", roomName: "Break Room" }, { roomNumber: "RM.L2.B1.018-AS", roomName: "Training Office - 1" }, { roomNumber: "RM.L2.B1.019-AS", roomName: "Training Office - 2" }, { roomNumber: "RM.L2.B1.020-AS", roomName: "Training Room - Ajman" }] }, "Pier C": { "Airside": [{ roomNumber: "RM.L2.C1.002-AS", roomName: "Locker Room" }, { roomNumber: "RM.L2.C1.003-AS", roomName: "Ramp Operations Control Centre" }, { roomNumber: "RM.L2.C1.005-AS", roomName: "ROM AND DM" }, { roomNumber: "RM.L2.C1.006-AS", roomName: "Ramp Team Leaders" }, { roomNumber: "RM.L2.C1.012-AS", roomName: "Break Room - 2" }, { roomNumber: "RM.L2.C1.013-AS", roomName: "Rest Area - 1" }, { roomNumber: "RM.L2.C1.014-AS", roomName: "Break Room -1" }, { roomNumber: "RM.L2.C1.015-AS", roomName: "Rest Area -1" }, { roomNumber: "RM.L2.C1.021-AS", roomName: "Break Room" }, { roomNumber: "RM.L2.C1.024-AS", roomName: "Supervisor & DO" }, { roomNumber: "RM.L2.C1.025-AS", roomName: "HOD" }, { roomNumber: "RM.L2.C1.026-AS", roomName: "Transport supervisors" }, { roomNumber: "RM.L2.C1.027-AS", roomName: "Planning Administrators" }, { roomNumber: "RM.L2.C1.035-AS", roomName: "Management Office" }] } },
  "Level 3": { "Core Building": { "Airside": [{ roomNumber: "RM.L3.3.038-AS", roomName: "Support Office (Dep)" }, { roomNumber: "RM.L3.3.039-AS", roomName: "Supervisor Office" }] }, "Departure Side": { "Landside": [{ roomNumber: "RM.L3.1.019a-LS", roomName: "Ticketing Counter" }, { roomNumber: "RM.L3.1.019-LS", roomName: "Ticketing Office HUB" }, { roomNumber: "RM.L3.1.029a-LS", roomName: "Ticketing Counter" }, { roomNumber: "RM.L3.1.029-LS", roomName: "Ticketing Service Office" }, { roomNumber: "RM.L3.2.304-LS", roomName: "First Class Area - Behind Wall" }] } },
  "Level 4": { "Departure Side": { "Landside": [{ roomNumber: "RM.L4.2.002-LS", roomName: "Deployment Office / Break Room" }] } },
  "Level 5": { "Core Building": { "Airside": [{ roomNumber: "RM.L5.3.131-AS", roomName: "Office" }, { roomNumber: "RM.L5.3.132-AS", roomName: "Office" }, { roomNumber: "RM.L5.5.125-AS", roomName: "Break Room" }, { roomNumber: "RM.L5.5.168-AS", roomName: "Transfer Office 1" }, { roomNumber: "RM.L5.5.169-AS", roomName: "Transfer Office 2" }] }, "Departure Side": { "Landside": [{ roomNumber: "RM.L5.2.012-LS", roomName: "Management Office" }, { roomNumber: "RM.L5.2.018-LS", roomName: "Office" }, { roomNumber: "RM.L5.2.019-LS", roomName: "Management Office" }, { roomNumber: "RM.L5.2.020-LS", roomName: "VP" }, { roomNumber: "RM.L5.2.021-LS", roomName: "HOD / SM" }, { roomNumber: "RM.L5.2.023-LS", roomName: "Store Room C-2" }, { roomNumber: "RM.L5.2.026-LS", roomName: "Meeting Room - RAK" }, { roomNumber: "RM.L5.2.030-LS", roomName: "Operations Excellence Office" }, { roomNumber: "RM.L5.2.035-LS", roomName: "Store T-1" }, { roomNumber: "RM.L5.2.040-LS", roomName: "Management Office" }, { roomNumber: "RM.L5.2.042-LS", roomName: "Meeting Room - Abu Dhabi" }, { roomNumber: "RM.L5.2.043-LS", roomName: "Meeting Room - Dubai" }, { roomNumber: "RM.L5.2.044-LS", roomName: "Meeting Room - Sharjah" }] } }
};

const businessParkData = {
  1: { "101": { displayName: "Office 101", roomName: "IT Office" }, "102": { displayName: "Office 102", roomName: "IT Office" }, "103": { displayName: "Office 103", roomName: "IT Office / IT Stores" } },
  2: { "209": { displayName: "Office 209", roomName: "HR Office" }, "210": { displayName: "Office 210", roomName: "HR Office" }, "211": { displayName: "Office 211", roomName: "IT Office" }, "212": { displayName: "Office 212", roomName: "IT Office" }, "213": { displayName: "Office 213", roomName: "Pantry" } },
  4: { "401": { displayName: "Office 401", roomName: "CEO Cabin" }, "402": { displayName: "Office 402", roomName: "Executive Assistant Office" }, "403": { displayName: "Office 403", roomName: "COO Cabin" }, "404": { displayName: "Office 404", roomName: "CSO Cabin" }, "405": { displayName: "Office 405", roomName: "CLO Cabin" }, "406": { displayName: "Office 406", roomName: "CFO Cabin" }, "407": { displayName: "Office 407", roomName: "HOD - Finance" }, "408": { displayName: "Office 408", roomName: "Meeting Room" }, "409": { displayName: "Office 409", roomName: "VP - Procurement Office" }, "410": { displayName: "Office 410", roomName: "Management Office" }, "411": { displayName: "Office 411", roomName: "GM Office" }, "412": { displayName: "Office 412", roomName: "CCO Cabin" }, "413": { displayName: "Office 413", roomName: "HOD Commercial" }, "414": { displayName: "Office 414", roomName: "CCO Office" }, "415": { displayName: "Office 415", roomName: "Meeting Room 1" }, "416": { displayName: "Office 416", roomName: "Meeting Room 2" }, "417": { displayName: "Office 417", roomName: "Meeting Suite" }, "418": { displayName: "Office 418", roomName: "Meeting Room 3" }, "419": { displayName: "Office 419", roomName: "Boardroom" }, "420": { displayName: "Office 420", roomName: "Finance Office" }, "421": { displayName: "Office 421", roomName: "Finance Office" }, "422": { displayName: "Office 422", roomName: "Strategy Office" }, "423": { displayName: "Office 423", roomName: "Legal/Compliance Office" }, "424": { displayName: "Office 424", roomName: "Inside Corridor" }, "RECEPTION": { displayName: "Reception Area", roomName: "Reception Area" }, "STORE": { displayName: "Store Room", roomName: "Store Room" }, "PANTRY": { displayName: "Pantry", roomName: "Pantry" }, "PRAYER": { displayName: "Prayer Room", roomName: "Prayer Room" }, "TOILET": { displayName: "Toilet", roomName: "Toilet" } }
};

const hardServiceTypes = [
  { id: 1, displayName: "General Maintenance" },
  { id: 2, displayName: "Periodic Maintenance" },
  { id: 3, displayName: "Specialized Maintenance" }
];
const softServiceTypes = [
  { id: 4, displayName: "General Maintenance" },
  { id: 5, displayName: "Periodic Maintenance" },
  { id: 6, displayName: "Specialized Maintenance" }
];

// Pre-compiled list of all locations for the autocomplete search
const flatLocationsList = [];

// Parse Airport locations
Object.entries(airportLocations).forEach(([floor, subLocs]) => {
  Object.entries(subLocs).forEach(([subLoc, cats]) => {
    Object.entries(cats).forEach(([cat, rooms]) => {
      rooms.forEach((room) => {
        flatLocationsList.push({
          type: 'ZIA',
          display: `ZIA: ${floor} | ${subLoc} | ${cat} | ${room.roomNumber} - ${room.roomName}`,
          key: `ZIA|${floor}|${subLoc}|${cat}|${room.roomNumber}|${room.roomName}`,
          searchStr: `zia zayed international airport ${floor} ${subLoc} ${cat} ${room.roomNumber} ${room.roomName}`.toLowerCase()
        });
      });
    });
  });
});

// Parse Business Park locations
Object.entries(businessParkData).forEach(([floor, offices]) => {
  Object.entries(offices).forEach(([officeNo, info]) => {
    flatLocationsList.push({
      type: 'BP',
      display: `BP: Level ${floor} | ${info.displayName} | ${info.roomName}`,
      key: `BP|${floor}|${officeNo}|${info.roomName}`,
      searchStr: `bp business park level ${floor} ${info.displayName} ${info.roomName}`.toLowerCase()
    });
  });
});

// Add some common pre-set areas
const commonFloors = ["Ground Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];
const commonAreas = ["Public Area", "Hygiene Area", "Critical Area"];
// Checklist item labels, used in evidence-requirement validation messages.
const VELORA_ITEM_LABELS = { floors: 'Floors & Surfaces', furniture: 'Furniture & Blinds', walls: 'Walls, Doors & Windows' };
commonAreas.forEach((area) => {
  commonFloors.forEach((floor) => {
    flatLocationsList.push({
      type: area,
      display: `${area}: ${floor}`,
      key: `Other|${area}|${floor}||`,
      searchStr: `${area} other level ${floor}`.toLowerCase()
    });
  });
});

// Helper to convert files to base64
const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        let maxWidth = 300;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        let result = canvas.toDataURL('image/jpeg', 0.3);
        if (result.length > 30000) result = canvas.toDataURL('image/jpeg', 0.2);
        resolve(result);
      };
      img.onerror = () => resolve(null);
    };
    reader.onerror = () => resolve(null);
  });
};

const fetchLocalImageBase64 = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to fetch local image', e);
    return null;
  }
};

export default function VeloraApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { show } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');

  // A stable id for the audit currently open in the workspace, so repeated
  // offline saves update ONE device-local record instead of piling up (and two
  // different audits never overwrite each other). Reset when the form is cleared;
  // set to a draft's own id when resuming a device-held draft.
  const localIdRef = useRef(newLocalId());

  // State shared by workspace tab (so draft loads correctly)
  const [draftId, setDraftId] = useState(null);
  const [auditNumber, setAuditNumber] = useState(null);
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditorName, setAuditorName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [auditResponses, setAuditResponses] = useState({});
  const [currentEditingLocation, setCurrentEditingLocation] = useState(0);

  // Stats refresh state
  const [statsTrigger, setStatsTrigger] = useState(0);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraCallback, setCameraCallback] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      navigate('/admin');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      setAuditorName(user.username);
    }
  }, [user]);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.resumeDraft) {
      loadDraftIntoWorkspace(location.state.resumeDraft);
      window.history.replaceState({}, document.title);
    } else if (location.state?.resumeOfflineDraft) {
      loadOfflineDraft(location.state.resumeOfflineDraft);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  if (user?.role === 'SUPERADMIN') return null;

  function loadDraftIntoWorkspace(draft) {
    setDraftId(draft.id);
    setAuditNumber(draft.auditNumber);
    setServiceCategory(draft.serviceCategory || '');
    setServiceTypeId(draft.serviceTypeId || '');
    if (draft.auditDate) {
      setAuditDate(new Date(draft.auditDate).toISOString().split('T')[0]);
    }
    setAuditorName(draft.auditorName || user?.username || '');
    
    // Parse location data and responses
    const locs = typeof draft.locationData === 'string' ? JSON.parse(draft.locationData) : (draft.locationData || []);
    const resps = typeof draft.responses === 'string' ? JSON.parse(draft.responses) : (draft.responses || {});
    
    setSelectedLocations(locs);
    setAuditResponses(resps);
    setCurrentEditingLocation(0);
    // A server draft is the canonical copy: start a fresh local slot so future
    // offline saves of this session get their own record.
    localIdRef.current = newLocalId();
    setActiveTab('audit');
  }

  // Resume a draft that only exists on this device (saved while offline). Its
  // payload is the exact autosave snapshot, so it maps straight onto state — and
  // we keep its localId so continued edits update the same device record.
  function loadOfflineDraft(record) {
    const p = record.payload || {};
    localIdRef.current = record.localId;
    setDraftId(record.serverId || null);
    setAuditNumber(null);
    setServiceCategory(p.serviceCategory || '');
    setServiceTypeId(p.serviceTypeId || '');
    if (p.auditDate) setAuditDate(p.auditDate);
    setAuditorName(p.auditorName || user?.username || '');
    setSelectedLocations(p.selectedLocations || []);
    setAuditResponses(p.auditResponses || {});
    setCurrentEditingLocation(0);
    setActiveTab('audit');
  }

  // Push any device-held drafts to the server on mount and whenever the
  // connection is restored. This covers drafts from OTHER audit sessions (e.g.
  // the user saved audit A offline, moved on to audit B — A still syncs).
  useEffect(() => {
    const runSync = () => { syncOfflineDrafts('velora', pushVeloraDraft).catch(() => {}); };
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  const startCamera = (callback) => {
    setCameraCallback(() => callback);
    setCameraActive(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        show('Camera access denied or not available.', 'error');
        setCameraActive(false);
      });
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      
      if (cameraCallback) {
        cameraCallback(imageData);
      }
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraCallback(null);
  };

  const clearForm = () => {
    setDraftId(null);
    setAuditNumber(null);
    setServiceCategory('');
    setServiceTypeId('');
    setAuditDate(new Date().toISOString().split('T')[0]);
    setAuditorName(user?.username || '');
    setNotes('');
    setSelectedLocations([]);
    setAuditResponses({});
    setCurrentEditingLocation(0);
    // Drop this session's device-local copy and start a fresh slot for the next audit.
    deleteOfflineDraft(localIdRef.current).catch(() => {});
    localIdRef.current = newLocalId();
  };

  return (
    <div className="velora-container">
      <div className="velora-wrapper">
        <header className="velora-header">
          <div 
            className="velora-header-left" 
            onClick={() => navigate('/')} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/');
              }
            }}
            role="button"
            tabIndex={0}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div className="velora-title-section">
              <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--velora-text-main)', margin: '0 0 2px 0' }}>VELORA FACILITIES PERFORMANCE</h1>
            </div>
          </div>
          <div className="velora-header-actions">
            <NetworkStatus />
            <ThemeToggle />
            <div className="velora-badge">
              {user?.username} · {user?.role}
            </div>
            <button className="velora-btn-text" onClick={() => navigate('/')}>
              <LayoutDashboard size={14} /> Dashboard
            </button>
            <button className="velora-btn-text" onClick={logout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <nav className="velora-nav-tabs">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'audit', label: 'Service Audit', icon: ClipboardList },
            { id: 'drafts', label: 'Drafts', icon: Save },
            { id: 'reports', label: 'PDF Reports', icon: FileText },
            { id: 'service-reports', label: 'Service Reports', icon: FileSpreadsheet },
            { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'dashboard') setStatsTrigger(prev => prev + 1);
              }}
              className={`velora-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </nav>

        <main>
          {activeTab === 'dashboard' && (
            <DashboardStats statsTrigger={statsTrigger} />
          )}

          {activeTab === 'audit' && (
            <AuditWorkspace
              draftId={draftId}
              setDraftId={setDraftId}
              auditNumber={auditNumber}
              setAuditNumber={setAuditNumber}
              serviceCategory={serviceCategory}
              setServiceCategory={setServiceCategory}
              serviceTypeId={serviceTypeId}
              setServiceTypeId={setServiceTypeId}
              auditDate={auditDate}
              setAuditDate={setAuditDate}
              auditorName={auditorName}
              setAuditorName={setAuditorName}
              notes={notes}
              setNotes={setNotes}
              selectedLocations={selectedLocations}
              setSelectedLocations={setSelectedLocations}
              auditResponses={auditResponses}
              setAuditResponses={setAuditResponses}
              currentEditingLocation={currentEditingLocation}
              setCurrentEditingLocation={setCurrentEditingLocation}
              startCamera={startCamera}
              clearForm={clearForm}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'drafts' && (
            <DraftsList
              loadDraft={loadDraftIntoWorkspace}
              loadOfflineDraft={loadOfflineDraft}
              activeTab={activeTab}
              onStartNew={() => setActiveTab('audit')}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsList onStartNew={() => setActiveTab('audit')} />
          )}

          {activeTab === 'service-reports' && (
            <ServiceReportsList />
          )}

          {activeTab === 'compliance' && (
            <ComplianceList />
          )}
        </main>
      </div>

      {/* Embedded React Camera Modal */}
      {cameraActive && (
        <div className="velora-camera-modal" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 10000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <video ref={videoRef} autoPlay playsInline style={{
            maxWidth: '90%', maxHeight: '70vh', borderRadius: 'var(--radius)', border: '2px solid white'
          }} />
          <div style={{ marginTop: '20px', display: 'flex', gap: '16px' }}>
            <button className="velora-btn-primary" onClick={capturePhoto}>
              <Camera size={16} /> Capture
            </button>
            <button className="velora-btn-danger" onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 1. Dashboard Stats Component
// -----------------------------------------------------------------------------
function DashboardStats({ statsTrigger }) {
  const { show } = useToast();
  const [stats, setStats] = useState({
    total_audits: 0,
    total_reports: 0,
    compliance_rate: 0,
    kpi_score: 0,
    performance_rating: 'Poor'
  });

  useEffect(() => {
    api.get('/api/velora/stats')
      .then(res => {
        if (res.data?.success) {
          setStats(res.data.data);
        }
      })
      .catch(err => show('Failed to load stats.', 'error'));
  }, [statsTrigger]);

  return (
    <div>
      <div className="velora-stats-grid">
        <div className="velora-stat-card">
          <div className="velora-stat-icon"><ClipboardList size={22} /></div>
          <div className="velora-stat-value">{stats.total_audits}</div>
          <div className="velora-stat-label">Total Audits</div>
        </div>
        <div className="velora-stat-card">
          <div className="velora-stat-icon"><FileText size={22} /></div>
          <div className="velora-stat-value">{stats.total_reports}</div>
          <div className="velora-stat-label">PDF Reports</div>
        </div>
        <div className="velora-stat-card">
          <div className="velora-stat-icon"><ShieldCheck size={22} /></div>
          <div className="velora-stat-value">{stats.compliance_rate}%</div>
          <div className="velora-stat-label">Compliance Rate</div>
        </div>
        <div className="velora-stat-card">
          <div className="velora-stat-icon"><CheckCircle size={22} /></div>
          <div className="velora-stat-value">{stats.performance_rating}</div>
          <div className="velora-stat-label">Performance Rating</div>
        </div>
      </div>

      <div className="velora-kpi-card">
        <div>
          <h3 style={{ color: 'var(--zinc-300)', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700 }}>KPI Score Card</h3>
          <p style={{ color: 'var(--zinc-400)', margin: '4px 0 0 0', fontSize: '0.8rem' }}>Overall Performance Score</p>
        </div>
        <div className="velora-kpi-score">
          {stats.kpi_score.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Audit Workspace (The Form, Location selection, checklist editing)
// -----------------------------------------------------------------------------
function AuditWorkspace({
  draftId, setDraftId,
  auditNumber, setAuditNumber,
  serviceCategory, setServiceCategory,
  serviceTypeId, setServiceTypeId,
  auditDate, setAuditDate,
  auditorName, setAuditorName,
  notes, setNotes,
  selectedLocations, setSelectedLocations,
  auditResponses, setAuditResponses,
  currentEditingLocation, setCurrentEditingLocation,
  startCamera,
  clearForm,
  setActiveTab
}) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);

  // Quick Search vs Manual Cascades selection mode
  const [useQuickSearch, setUseQuickSearch] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [customLocationName, setCustomLocationName] = useState('');

  // Soft service location picker states
  const [locationType, setLocationType] = useState('');
  const [locationError, setLocationError] = useState('');
  
  // ZIA Site Selection
  const [ziaFloor, setZiaFloor] = useState('');
  const [ziaSubLocation, setZiaSubLocation] = useState('');
  const [ziaCategory, setZiaCategory] = useState('');
  const [ziaRoomNumber, setZiaRoomNumber] = useState('');
  const [ziaRoomName, setZiaRoomName] = useState('');

  // Business Park Site Selection
  const [bpFloor, setBpFloor] = useState('');
  const [bpOfficeNumber, setBpOfficeNumber] = useState('');
  const [bpRoomName, setBpRoomName] = useState('');

  // Other Areas Site Selection
  const [otherSite, setOtherSite] = useState('');
  const [otherFloor, setOtherFloor] = useState('');
  const [otherZone, setOtherZone] = useState('');
  const [otherLocationName, setOtherLocationName] = useState('');

  // Silently keep the draft in sync while the user works — separate from the
  // manual Save Draft button, which still gives its own toast.
  const autosave = useAutosave(
    { serviceCategory, serviceTypeId, auditDate, auditorName, selectedLocations, auditResponses },
    async (d) => {
      const res = await api.post('/api/velora/drafts', {
        draftId,
        auditNumber,
        serviceTypeId: parseInt(d.serviceTypeId, 10),
        serviceCategory: d.serviceCategory,
        auditDate: d.auditDate,
        auditorName: d.auditorName,
        locations: d.selectedLocations,
        responses: d.auditResponses,
      });
      if (res.data?.success) {
        setDraftId(res.data.data.draft.id);
        setAuditNumber(res.data.data.draft.auditNumber);
      }
    },
    {
      enabled: !!serviceCategory && !!serviceTypeId && !loading,
      offline: {
        module: 'velora',
        getLocalId: () => localIdRef.current,
        getServerId: () => draftId,
        getLabel: () => `${(serviceCategory || 'Audit').toUpperCase()} — ${auditorName || user?.username || 'Auditor'}`,
      },
    },
  );

  // Category Change Handler
  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setServiceCategory(val);
    setServiceTypeId('');
    setSelectedLocations([]);
    setAuditResponses({});
    setCurrentEditingLocation(0);

    if (val === 'hard') {
      // Hard services automatically gets a single hard service location entry
      setSelectedLocations([{ key: 'hard_service', locationType: 'Hard Service', displayName: 'Hard Service Audit' }]);
      setAuditResponses({ hard_service: { observations: [] } });
    }
  };

  // Add Location for Soft services
  const addLocation = () => {
    if (!locationType) {
      show('Please select a Location Type.', 'error');
      return;
    }

    let key = '';
    let displayName = '';

    if (locationType === 'ZIA') {
      if (!ziaFloor || !ziaSubLocation || !ziaCategory || !ziaRoomNumber || !ziaRoomName) {
        const msg = 'Please fill in all airport location fields.';
        setLocationError(msg);
        show(msg, 'error');
        return;
      }
      key = `ZIA|${ziaFloor}|${ziaSubLocation}|${ziaCategory}|${ziaRoomNumber}|${ziaRoomName}`;
      displayName = `ZIA: ${ziaFloor} | ${ziaSubLocation} | ${ziaCategory} | ${ziaRoomNumber} - ${ziaRoomName}`;
    } else if (locationType === 'BP') {
      if (!bpFloor || !bpOfficeNumber || !bpRoomName) {
        const msg = 'Please fill in all office location fields.';
        setLocationError(msg);
        show(msg, 'error');
        return;
      }
      key = `BP|${bpFloor}|${bpOfficeNumber}|${bpRoomName}`;
      displayName = `BP: Level ${bpFloor} | ${businessParkData[bpFloor][bpOfficeNumber].displayName} | ${bpRoomName}`;
    } else {
      if (!otherSite || !otherFloor) {
        const msg = 'Please select Site and Floor.';
        setLocationError(msg);
        show(msg, 'error');
        return;
      }
      if (!otherZone && !otherLocationName) {
        const msg = 'Please enter Zone/Sub Area or Location Name.';
        setLocationError(msg);
        show(msg, 'error');
        return;
      }
      key = `Other|${otherSite}|${otherFloor}|${otherZone}|${otherLocationName}`;
      displayName = `${otherSite}: Level ${otherFloor}${otherZone ? ' | ' + otherZone : ''}${otherLocationName ? ' | ' + otherLocationName : ''}`;
    }

    if (selectedLocations.some(loc => loc.key === key)) {
      const msg = 'Location already added.';
      setLocationError(msg);
      show(msg, 'error');
      return;
    }

    setLocationError('');
    const newLocs = [...selectedLocations, { key, locationType, displayName }];
    setSelectedLocations(newLocs);

    const newResponses = { ...auditResponses };
    if (!newResponses[key]) {
      newResponses[key] = { observations: [] };
    }
    setAuditResponses(newResponses);

    // Reset fields
    setZiaFloor('');
    setZiaSubLocation('');
    setZiaCategory('');
    setZiaRoomNumber('');
    setZiaRoomName('');
    setBpFloor('');
    setBpOfficeNumber('');
    setBpRoomName('');
    setOtherSite('');
    setOtherFloor('');
    setOtherZone('');
    setOtherLocationName('');
  };

  const removeLocation = (idx) => {
    const loc = selectedLocations[idx];
    const newLocs = selectedLocations.filter((_, i) => i !== idx);
    setSelectedLocations(newLocs);

    const newResponses = { ...auditResponses };
    delete newResponses[loc.key];
    setAuditResponses(newResponses);

    if (newLocs.length > 0) {
      setCurrentEditingLocation(Math.min(currentEditingLocation, newLocs.length - 1));
    }
  };

  // Add Observation to checklist
  const addObservation = (locationKey) => {
    setAuditResponses((prev) => {
      const copy = { ...prev };
      if (!copy[locationKey]) {
        copy[locationKey] = { observations: [] };
      } else {
        copy[locationKey] = { ...copy[locationKey] };
      }

      const newObservation = {
        id: Date.now() + Math.random(),
        floors: { response: null, comment: '', images: [] },
        furniture: { response: null, comment: '', images: [] },
        walls: { response: null, comment: '', images: [] }
      };

      copy[locationKey].observations = [...(copy[locationKey].observations || []), newObservation];
      return copy;
    });
  };

  const removeObservation = (locationKey, obsId) => {
    setAuditResponses((prev) => {
      const copy = { ...prev };
      if (!copy[locationKey]) return prev;
      copy[locationKey] = {
        ...copy[locationKey],
        observations: (copy[locationKey].observations || []).filter(o => o.id !== obsId)
      };
      return copy;
    });
  };

  // Centralized helper to update an observation checklist item immutably
  const updateObservationItem = (locationKey, obsId, itemKey, updateFn) => {
    setAuditResponses((prev) => {
      const copy = { ...prev };
      if (!copy[locationKey]?.observations) return prev;
      copy[locationKey] = { ...copy[locationKey] };
      copy[locationKey].observations = copy[locationKey].observations.map(obs => {
        if (obs.id === obsId) {
          return {
            ...obs,
            [itemKey]: updateFn(obs[itemKey] || { response: null, comment: '', images: [] })
          };
        }
        return obs;
      });
      return copy;
    });
  };

  const updateItemResponse = (locationKey, obsId, itemKey, response) => {
    updateObservationItem(locationKey, obsId, itemKey, (item) => ({ ...item, response }));
  };

  const updateItemComment = (locationKey, obsId, itemKey, comment) => {
    updateObservationItem(locationKey, obsId, itemKey, (item) => ({ ...item, comment }));
  };

  const handleFileUpload = async (locationKey, obsId, itemKey, files) => {
    if (!files || files.length === 0) return;

    const obs = auditResponses[locationKey]?.observations.find(o => o.id === obsId);
    if (!obs) return;
    const currentCount = (obs[itemKey]?.images || []).length;
    if (currentCount >= 5) {
      show('Max 5 images allowed per category.', 'error');
      return;
    }

    const uploadedImages = [];
    for (let file of Array.from(files)) {
      if (currentCount + uploadedImages.length >= 5) {
        show('Max 5 images allowed per category.', 'error');
        break;
      }
      const base64 = await compressImage(file);
      if (base64) {
        uploadedImages.push(base64);
      }
    }

    if (uploadedImages.length === 0) return;

    updateObservationItem(locationKey, obsId, itemKey, (item) => ({
      ...item,
      images: [...(item.images || []), ...uploadedImages].slice(0, 5)
    }));
  };

  const removeImage = (locationKey, obsId, itemKey, imgIndex) => {
    updateObservationItem(locationKey, obsId, itemKey, (item) => ({
      ...item,
      images: (item.images || []).filter((_, idx) => idx !== imgIndex)
    }));
  };

  // Add Camera Image to Checklist Item
  const handleAddCameraPhoto = (locationKey, obsId, itemKey) => {
    const obs = auditResponses[locationKey]?.observations.find(o => o.id === obsId);
    if (!obs) return;
    if ((obs[itemKey]?.images || []).length >= 5) {
      show('Max 5 images allowed per category.', 'error');
      return;
    }
    startCamera((base64Image) => {
      updateObservationItem(locationKey, obsId, itemKey, (item) => ({
        ...item,
        images: [...(item.images || []), base64Image]
      }));
    });
  };

  // Save Draft
  const saveDraft = async () => {
    if (!serviceCategory || !serviceTypeId) {
      show('Please select Service Category and Type first.', 'error');
      return;
    }
    setLoading(true);
    try {
      // Goes through the same save path as autosave (flush bypasses its debounce)
      // so there's only ever one source of truth for "is this draft saved".
      const result = await autosave.flush();
      if (result === 'saved' || result === 'skipped') {
        show('Draft saved successfully!', 'success');
      } else if (result === 'offline') {
        show('Offline — draft kept on this device and will sync when back online.', 'info');
      } else if (result === 'error') {
        show('Failed to save draft.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if observation is completely empty
  const isObservationEmpty = (obs) => {
    return !obs.floors?.response && !obs.furniture?.response && !obs.walls?.response;
  };

  // Submit and Generate PDF
  const submitAudit = async () => {
    // Validate responses
    if (selectedLocations.length === 0) {
      show('Please add at least one location.', 'error');
      return;
    }

    // Filter out completely empty observations for validation and API payload
    const filteredResponses = {};
    for (const key of Object.keys(auditResponses)) {
      const locObs = auditResponses[key]?.observations || [];
      const nonEmptyObs = locObs.filter(obs => !isObservationEmpty(obs));
      filteredResponses[key] = {
        ...auditResponses[key],
        observations: nonEmptyObs
      };
    }

    let valid = true;
    for (const loc of selectedLocations) {
      const responses = filteredResponses[loc.key];
      if (!responses || !responses.observations || responses.observations.length === 0) {
        show(`Please add at least one observation for ${loc.displayName}`, 'error');
        valid = false;
        break;
      }

      for (let i = 0; i < responses.observations.length; i++) {
        const obs = responses.observations[i];
        if (!obs.floors.response || !obs.furniture.response || !obs.walls.response) {
          show(`Please select response status for Observation #${i + 1} at ${loc.displayName}`, 'error');
          valid = false;
          break;
        }
        // Non-compliant items (Needs Improvement / Unacceptable) require evidence:
        // a remark AND at least one photo.
        for (const key of ['floors', 'furniture', 'walls']) {
          const it = obs[key] || {};
          if (['Needs Improvement', 'Unacceptable'].includes(it.response)) {
            if (!String(it.comment || '').trim() || !(it.images || []).length) {
              show(`${VELORA_ITEM_LABELS[key]} in Observation #${i + 1} at ${loc.displayName} is marked "${it.response}" — a remark and at least one photo are required.`, 'error');
              valid = false;
              break;
            }
          }
        }
        if (!valid) break;
      }
      if (!valid) break;
    }

    if (!valid) return;

    setLoading(true);
    try {
      const auditPayload = {
        serviceTypeId: parseInt(serviceTypeId, 10),
        serviceCategory,
        auditDate,
        auditorName,
        locations: selectedLocations,
        responses: filteredResponses,
        notes,
        draftId
      };

      const res = await api.post('/api/velora/audits', auditPayload);
      if (res.data?.success) {
        const savedAudit = res.data.data.audit;
        const generatedAuditNo = savedAudit.auditNumber;
        const generatedAuditId = savedAudit.id;

        show('Audit submitted successfully! Generating PDF...', 'success');

        // Calculate scores for client-side PDF
        let totalItems = 0;
        let scoreSum = 0;
        selectedLocations.forEach(loc => {
          const locObs = filteredResponses[loc.key]?.observations || [];
          locObs.forEach(obs => {
            ['floors', 'furniture', 'walls'].forEach(item => {
              if (obs[item].response) {
                totalItems++;
                if (obs[item].response === 'Acceptable') scoreSum += 100;
                else if (obs[item].response === 'Needs Improvement') scoreSum += 50;
              }
            });
          });
        });
        const finalScore = totalItems > 0 ? (scoreSum / totalItems) : 0;
        const rating = finalScore >= 90 ? 'Excellent' : (finalScore >= 75 ? 'Good' : (finalScore >= 60 ? 'Average' : 'Poor'));

        // Client-side PDF Generation with jsPDF (Unified branding style)
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 18;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - margin * 2;
        let y = 58;

        const addHeader = (pageNum) => {
          doc.setPage(pageNum);
          doc.setDrawColor(228, 228, 231); // zinc-200
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, 45, 'F');
          doc.line(margin, 45, pageWidth - margin, 45);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(24, 24, 27); // zinc-900
          doc.text('Facilities Audit Report', pageWidth - margin, 25, { align: 'right' });

          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setDrawColor(228, 228, 231);
          doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(113, 113, 122); // zinc-500

          doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        };

        addHeader(1);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(24, 24, 27);
        doc.text('AUDIT INFORMATION', margin, y);
        y += 8;

        doc.setFillColor(250, 250, 250); // zinc-50
        doc.rect(margin, y - 2, contentWidth, 38, 'F');
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.rect(margin, y - 2, contentWidth, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(63, 63, 70); // zinc-700

        doc.text(`Audit Number: ${generatedAuditNo}`, margin + 6, y + 6);
        doc.text(`Service Category: ${serviceCategory === 'hard' ? 'Hard Services' : 'Soft Services'}`, margin + 6, y + 14);
        doc.text(`Service Type: ${(serviceCategory === 'hard' ? hardServiceTypes : softServiceTypes).find(t => t.id === parseInt(serviceTypeId, 10))?.displayName || ''}`, margin + 6, y + 22);
        doc.text(`Audit Date: ${auditDate}  |  Auditor: ${auditorName}`, margin + 6, y + 30);
        y += 48;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(24, 24, 27);
        doc.text('PERFORMANCE SCORE', margin, y);
        y += 8;

        // Score panel
        doc.setFillColor(24, 24, 27); // zinc-900
        doc.roundedRect(margin, y - 2, contentWidth, 24, 4, 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(250, 204, 21); // amber-400 equivalent for score text
        doc.text(`${finalScore.toFixed(1)}%`, margin + 8, y + 14);

        let rColor, gColor, bColor;
        if (finalScore >= 90) { rColor = 22; gColor = 101; bColor = 52; } // green-800
        else if (finalScore >= 75) { rColor = 133; gColor = 77; bColor = 14; } // yellow-800
        else { rColor = 153; gColor = 27; bColor = 27; } // red-800
        doc.setFillColor(rColor, gColor, bColor);
        doc.roundedRect(pageWidth - margin - 42, y + 4, 36, 12, 6, 6, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(rating.toUpperCase(), pageWidth - margin - 24, y + 12, { align: 'center' });
        y += 38;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(24, 24, 27);
        doc.text('AUDIT FINDINGS & OBSERVATIONS', margin, y);
        y += 8;

        doc.setDrawColor(24, 24, 27);
        doc.setLineWidth(0.4);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
        y += 4;

        let obsCount = 1;
        selectedLocations.forEach((loc) => {
          const locObs = filteredResponses[loc.key]?.observations || [];
          if (locObs.length === 0) return;

          if (y > 245) {
            doc.addPage();
            addHeader(doc.internal.getNumberOfPages());
            y = 58;
          }

          // Section Header for Location
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.setFillColor(39, 39, 42); // zinc-800
          doc.rect(margin, y, contentWidth, 8, 'F');
          doc.text(loc.displayName.toUpperCase(), margin + 4, y + 5.5);
          y += 14;

          locObs.forEach((obs) => {
            if (y > 230) {
              doc.addPage();
              addHeader(doc.internal.getNumberOfPages());
              y = 58;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(24, 24, 27); // zinc-900
            doc.text(`Observation #${obsCount++}`, margin, y);
            y += 6;

            const checklistItems = [
              { label: 'Floors & Surfaces', val: obs.floors },
              { label: 'Furniture & Blinds', val: obs.furniture },
              { label: 'Walls, Doors & Windows', val: obs.walls }
            ];

            checklistItems.forEach((item) => {
              if (y > 255) {
                doc.addPage();
                addHeader(doc.internal.getNumberOfPages());
                y = 58;
              }

              if (item.val.response === 'Acceptable') doc.setTextColor(22, 101, 52); // green
              else if (item.val.response === 'Needs Improvement') doc.setTextColor(133, 77, 14); // amber
              else doc.setTextColor(153, 27, 27); // red

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              doc.text(`• ${item.label}: ${item.val.response || 'N/A'}`, margin + 4, y);
              
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(82, 82, 91); // zinc-600
              y += 5;

              if (item.val.comment) {
                const commentText = `  Remark: ${item.val.comment}`;
                const splitComment = doc.splitTextToSize(commentText, contentWidth - 8);
                doc.text(splitComment, margin + 4, y);
                y += (4.5 * splitComment.length);
              }

              // Handle images
              if (item.val.images && item.val.images.length > 0) {
                const imgW = 32;
                const imgH = 32;
                let currX = margin + 4;
                
                // Keep image drawing height calculation safe
                if (y + imgH > 265) {
                  doc.addPage();
                  addHeader(doc.internal.getNumberOfPages());
                  y = 58;
                }

                item.val.images.forEach((imgData) => {
                  if (currX + imgW > pageWidth - margin) {
                    currX = margin + 4;
                    y += imgH + 4;
                    if (y + imgH > 265) {
                      doc.addPage();
                      addHeader(doc.internal.getNumberOfPages());
                      y = 58;
                      currX = margin + 4;
                    }
                  }
                  try {
                    doc.addImage(imgData, 'JPEG', currX, y, imgW, imgH);
                  } catch (e) {
                    console.error('jsPDF error adding observation image', e);
                  }
                  currX += imgW + 4;
                });
                y += imgH + 6;
              }
            });
            
            // Draw a light grey separator between observations
            doc.setDrawColor(228, 228, 231);
            doc.setLineWidth(0.2);
            doc.line(margin, y - 2, pageWidth - margin, y - 2);
            y += 8;
          });
          y += 4;
        });

        // Add correct header footers dynamically for all generated pages
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          addHeader(i);
        }

        const pdfBlob = doc.output('blob');
        const pdfDataUrl = URL.createObjectURL(pdfBlob);

        // Convert blob to base64 to send to backend
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = async () => {
          const base64 = reader.result;
          await api.post('/api/velora/pdf-reports', {
            pdfData: base64,
            auditNumber: generatedAuditNo,
            auditId: generatedAuditId,
            title: `Audit Report ${generatedAuditNo}`
          });

          // Trigger browser download using the standard download helper method to ensure auth and UX consistency
          const link = document.createElement('a');
          link.href = pdfDataUrl;
          link.download = `${generatedAuditNo}_Audit_Report.pdf`;
          link.click();

          clearForm();
          setActiveTab('dashboard');
        };
      }
    } catch (err) {
      show('Failed to submit audit.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper variables to populate dropdown cascades
  const currentCategoryServiceTypes = serviceCategory === 'hard' ? hardServiceTypes : (serviceCategory === 'soft' ? softServiceTypes : []);

  // Soft Service Location Dropdown Lists
  const airportFloors = Object.keys(airportLocations);
  const airportSubLocations = ziaFloor ? Object.keys(airportLocations[ziaFloor] || {}) : [];
  const airportCategories = (ziaFloor && ziaSubLocation) ? Object.keys(airportLocations[ziaFloor][ziaSubLocation] || {}) : [];
  const airportRooms = (ziaFloor && ziaSubLocation && ziaCategory) ? airportLocations[ziaFloor][ziaSubLocation][ziaCategory] || [] : [];

  const bpFloors = Object.keys(businessParkData);
  const bpOffices = bpFloor ? Object.keys(businessParkData[bpFloor] || {}) : [];

  const getLiveStats = () => {
    let totalItems = 0;
    let scoreSum = 0;
    selectedLocations.forEach(loc => {
      const locObs = auditResponses[loc.key]?.observations || [];
      locObs.forEach(obs => {
        ['floors', 'furniture', 'walls'].forEach(item => {
          if (obs[item]?.response) {
            totalItems++;
            if (obs[item].response === 'Acceptable') scoreSum += 100;
            else if (obs[item].response === 'Needs Improvement') scoreSum += 50;
          }
        });
      });
    });
    const finalScore = totalItems > 0 ? Math.round(scoreSum / totalItems) : 0;
    return { totalItems, finalScore };
  };

  const liveStats = getLiveStats();
  let scoreColor = 'var(--danger)'; // Red
  let rating = 'Poor';
  if (liveStats.finalScore >= 90) {
    scoreColor = 'var(--ok-fg)'; // Green
    rating = 'Excellent';
  } else if (liveStats.finalScore >= 75) {
    scoreColor = 'var(--warn-solid)'; // Orange
    rating = 'Good';
  } else if (liveStats.finalScore >= 60) {
    scoreColor = 'var(--primary)'; // Blue
    rating = 'Average';
  }

  return (
    <div className="velora-card">
      <div className="velora-card-title">
        <ClipboardList />
        {draftId ? `Edit Service Audit (Draft #${auditNumber})` : 'New Service Audit'}
      </div>

      {liveStats.totalItems > 0 && (
        <div style={{
          padding: '1rem',
          margin: '0 0 1.5rem 0',
          borderLeft: `4px solid ${scoreColor}`,
          background: 'var(--zinc-50)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--zinc-200)',
          borderLeftWidth: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--zinc-500)', letterSpacing: '0.5px' }}>Live Service Score</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: scoreColor }}>{liveStats.finalScore}%</span>
                <span style={{ fontSize: '0.85rem', color: scoreColor, fontWeight: '700' }}>({rating})</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--zinc-400)' }}>({liveStats.totalItems} elements graded)</span>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: '150px', maxWidth: '300px' }}>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--zinc-200)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${liveStats.finalScore}%`, height: '100%', backgroundColor: scoreColor, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--zinc-500)' }}>
                <span>Scoring progress active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="velora-form-grid">
        <div className="velora-input-group">
          <label>Service Category</label>
          <select value={serviceCategory} onChange={handleCategoryChange}>
            <option value="">Select Category</option>
            <option value="hard">Hard Services</option>
            <option value="soft">Soft Services</option>
          </select>
        </div>

        <div className="velora-input-group">
          <label>Service Type</label>
          <select
            value={serviceTypeId}
            onChange={(e) => setServiceTypeId(e.target.value)}
            disabled={!serviceCategory}
          >
            <option value="">{serviceCategory ? 'Select Service Type' : 'First select category'}</option>
            {currentCategoryServiceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {serviceCategory === 'soft' && (
        <div className="velora-location-area" style={{ border: '1.5px solid var(--zinc-300)', padding: '18px', borderRadius: 'var(--radius)', backgroundColor: 'var(--zinc-50)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}><MapPin size={16} /> Location Details</h3>
            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--zinc-200)', padding: '3px', borderRadius: '6px' }}>
              <button
                type="button"
                className="velora-btn-text"
                style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: useQuickSearch ? 'var(--primary)' : 'transparent', color: useQuickSearch ? '#fff' : 'var(--zinc-700)' }}
                onClick={() => setUseQuickSearch(true)}
              >
                Quick Search
              </button>
              <button
                type="button"
                className="velora-btn-text"
                style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: !useQuickSearch ? 'var(--primary)' : 'transparent', color: !useQuickSearch ? '#fff' : 'var(--zinc-700)' }}
                onClick={() => setUseQuickSearch(false)}
              >
                Standard Selector
              </button>
            </div>
          </div>

          {useQuickSearch ? (
            <div>
              <div className="velora-input-group" style={{ position: 'relative', marginBottom: '16px' }}>
                <label>Search and Add Location</label>
                <input
                  type="text"
                  placeholder="Search ZIA rooms, BP offices, zones (e.g. 101, IT, Core Building, Level 2)..."
                  value={searchQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setSearchQuery(query);
                    if (query.trim().length >= 1) {
                      const filtered = flatLocationsList.filter(item => 
                        item.searchStr.includes(query.toLowerCase())
                      ).slice(0, 8);
                      setSearchResults(filtered);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                />
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1.5px solid var(--zinc-300)',
                    borderRadius: '0 0 var(--radius) var(--radius)',
                    zIndex: 1000,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--zinc-100)',
                          fontSize: '0.82rem',
                          color: '#27272a',
                          textAlign: 'left'
                        }}
                        onClick={() => {
                          if (selectedLocations.some(loc => loc.key === item.key)) {
                            show('Location already added.', 'error');
                          } else {
                            setSelectedLocations([...selectedLocations, { key: item.key, locationType: item.type, displayName: item.display }]);
                            setAuditResponses(prev => ({
                              ...prev,
                              [item.key]: prev[item.key] || { observations: [] }
                            }));
                            show(`Added ${item.display}`, 'success');
                          }
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f4f4f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = ''}
                      >
                        {item.display}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end',
                border: '1px dashed var(--zinc-400)',
                borderRadius: 'var(--radius)',
                padding: '12px',
                marginTop: '16px',
                backgroundColor: 'var(--zinc-100)',
                flexWrap: 'wrap'
              }}>
                <div className="velora-input-group" style={{ flex: 1, marginBottom: 0, minWidth: '200px' }}>
                  <label>Add a Custom Location manually</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Lounge, General Lobby..."
                    value={customLocationName}
                    onChange={(e) => setCustomLocationName(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="velora-btn-primary"
                  style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem' }}
                  onClick={() => {
                    if (!customLocationName.trim()) {
                      show('Please enter a custom location name.', 'error');
                      return;
                    }
                    const name = customLocationName.trim();
                    const key = `Other|Custom|||${name}`;
                    const display = `Custom: ${name}`;

                    if (selectedLocations.some(loc => loc.key === key)) {
                      show('Location already added.', 'error');
                    } else {
                      setSelectedLocations([...selectedLocations, { key, locationType: 'Custom', displayName: display }]);
                      setAuditResponses(prev => ({
                        ...prev,
                        [key]: prev[key] || { observations: [] }
                      }));
                      show(`Added ${display}`, 'success');
                      setCustomLocationName('');
                    }
                  }}
                >
                  Add Custom
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="velora-form-grid">
                <div className="velora-input-group">
                  <label>Select Location</label>
                  <select value={locationType} onChange={(e) => { setLocationType(e.target.value); setLocationError(''); }}>
                    <option value="">Select Location Type</option>
                    <option value="ZIA">ZIA - Zayed International Airport</option>
                    <option value="BP">BP - Business Park</option>
                    <option value="Public Area">Public Area</option>
                    <option value="Hygiene Area">Hygiene Area</option>
                    <option value="Critical Area">Critical Area</option>
                  </select>
                </div>
              </div>

              {/* Airport Details Selector Cascade */}
              {locationType === 'ZIA' && (
                <div style={locationError ? { marginTop: '16px', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '12px' } : { marginTop: '16px' }}>
                  {locationError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '10px' }}>{locationError}</div>}
                  <div className="velora-form-grid">
                    <div className="velora-input-group">
                      <label>Floor / Level</label>
                      <select value={ziaFloor} onChange={(e) => {
                        setZiaFloor(e.target.value);
                        setZiaSubLocation('');
                        setZiaCategory('');
                        setZiaRoomNumber('');
                        setZiaRoomName('');
                      }}>
                        <option value="">Select Floor</option>
                        {airportFloors.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Sub Location</label>
                      <select
                        value={ziaSubLocation}
                        onChange={(e) => {
                          setZiaSubLocation(e.target.value);
                          setZiaCategory('');
                          setZiaRoomNumber('');
                          setZiaRoomName('');
                        }}
                        disabled={!ziaFloor}
                      >
                        <option value="">Select Sub Location</option>
                        {airportSubLocations.map(sl => <option key={sl} value={sl}>{sl}</option>)}
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Category</label>
                      <select
                        value={ziaCategory}
                        onChange={(e) => {
                          setZiaCategory(e.target.value);
                          setZiaRoomNumber('');
                          setZiaRoomName('');
                        }}
                        disabled={!ziaSubLocation}
                      >
                        <option value="">Select Category</option>
                        {airportCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="velora-form-grid" style={{ marginTop: '16px' }}>
                    <div className="velora-input-group">
                      <label>Room Number</label>
                      <select
                        value={ziaRoomNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setZiaRoomNumber(val);
                          const roomObj = airportRooms.find(r => r.roomNumber === val);
                          setZiaRoomName(roomObj ? roomObj.roomName : '');
                        }}
                        disabled={!ziaCategory}
                      >
                        <option value="">Select Room Number</option>
                        {airportRooms.map(r => <option key={r.roomNumber} value={r.roomNumber}>{r.roomNumber}</option>)}
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Room Name</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Room name auto-populates"
                        value={ziaRoomName}
                        style={{ background: 'var(--zinc-100)' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Business Park Selector Cascade */}
              {locationType === 'BP' && (
                <div style={locationError ? { marginTop: '16px', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '12px' } : { marginTop: '16px' }}>
                  {locationError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '10px' }}>{locationError}</div>}
                  <div className="velora-form-grid">
                    <div className="velora-input-group">
                      <label>Floor / Level</label>
                      <select value={bpFloor} onChange={(e) => {
                        setBpFloor(e.target.value);
                        setBpOfficeNumber('');
                        setBpRoomName('');
                      }}>
                        <option value="">Select Floor</option>
                        {bpFloors.map(f => <option key={f} value={f}>Level {f}</option>)}
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Office Number / Area</label>
                      <select
                        value={bpOfficeNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBpOfficeNumber(val);
                          setBpRoomName(businessParkData[bpFloor]?.[val]?.roomName || '');
                        }}
                        disabled={!bpFloor}
                      >
                        <option value="">Select Office/Area</option>
                        {bpOffices.map(o => <option key={o} value={o}>{businessParkData[bpFloor][o].displayName}</option>)}
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Room Name</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Room name auto-populates"
                        value={bpRoomName}
                        style={{ background: 'var(--zinc-100)' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Other Areas Selectors */}
              {['Public Area', 'Hygiene Area', 'Critical Area'].includes(locationType) && (
                <div style={locationError ? { marginTop: '16px', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '12px' } : { marginTop: '16px' }}>
                  {locationError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '10px' }}>{locationError}</div>}
                  <div className="velora-form-grid">
                    <div className="velora-input-group">
                      <label>Site</label>
                      <select value={otherSite} onChange={(e) => setOtherSite(e.target.value)}>
                        <option value="">Select Site</option>
                        <option value="Public Area">Public Area</option>
                        <option value="Hygiene Area">Hygiene Area</option>
                        <option value="Critical Area">Critical Area</option>
                      </select>
                    </div>
                    <div className="velora-input-group">
                      <label>Floor / Level</label>
                      <select value={otherFloor} onChange={(e) => setOtherFloor(e.target.value)}>
                        <option value="">Select Floor</option>
                        <option value="Ground Level">Ground Level</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                        <option value="Level 4">Level 4</option>
                        <option value="Level 5">Level 5</option>
                      </select>
                    </div>
                  </div>
                  <div className="velora-form-grid" style={{ marginTop: '16px' }}>
                    <div className="velora-input-group">
                      <label>Zone / Sub Area</label>
                      <input
                        type="text"
                        placeholder="e.g., Zone A, Section 1"
                        value={otherZone}
                        onChange={(e) => setOtherZone(e.target.value)}
                      />
                    </div>
                    <div className="velora-input-group">
                      <label>Specific Location Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Restroom 101, Corridor B"
                        value={otherLocationName}
                        onChange={(e) => setOtherLocationName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                className="velora-btn-secondary"
                style={{ marginTop: '16px' }}
                onClick={addLocation}
              >
                <Plus size={16} /> Add This Location
              </button>
            </div>
          )}
        </div>
      )}

      {/* Location Progress Hub (Stepper) */}
      {selectedLocations.length > 0 && (
        <div style={{ margin: '20px 0' }}>
          <div className="velora-section-header" style={{ marginBottom: '12px' }}>
            <h3>Location Progress Hub</h3>
          </div>
          <div className="velora-stepper">
            {selectedLocations.map((loc, idx) => {
              const isLocationComplete = (locKey) => {
                const responses = auditResponses[locKey];
                if (!responses || !responses.observations || responses.observations.length === 0) return false;
                return responses.observations.every(obs => obs.floors.response && obs.furniture.response && obs.walls.response);
              };
              
              const complete = isLocationComplete(loc.key);
              const isActive = currentEditingLocation === idx;
              
              // Get short clean name for the stepper pill
              let label = 'Hard Service';
              if (loc.locationType === 'BP') {
                const parts = loc.key.split('|');
                label = `Office ${parts[2] || '?'}`;
              } else if (loc.locationType === 'ZIA') {
                const parts = loc.key.split('|');
                label = `Room ${parts[4] || '?'}`;
              } else if (loc.locationType !== 'Hard Service') {
                const parts = loc.key.split('|');
                label = parts[4] || parts[3] || parts[1] || loc.displayName;
              }

              return (
                <div
                  key={loc.key}
                  className={`velora-stepper-step ${isActive ? 'active' : ''} ${complete ? 'completed' : ''}`}
                  onClick={() => setCurrentEditingLocation(idx)}
                  title={loc.displayName}
                >
                  <div className="step-number">{idx + 1}</div>
                  <div className="step-name">{label}</div>
                  {complete && <CheckCircle size={14} className="step-check" />}
                  {serviceCategory === 'soft' && (
                    <button
                      type="button"
                      className="velora-btn-icon"
                      style={{ 
                        marginLeft: '6px', 
                        padding: '2px', 
                        color: isActive ? 'white' : 'var(--velora-text-muted)',
                        opacity: 0.7
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocation(idx);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Date and Auditor */}
      <div className="velora-form-grid" style={{ marginTop: '20px' }}>
        <div className="velora-input-group">
          <label><Calendar size={14} /> Audit Date</label>
          <input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
        </div>
        <div className="velora-input-group">
          <label><User size={14} /> Auditor Name</label>
          <input
            type="text"
            placeholder="Enter auditor name"
            value={auditorName}
            onChange={(e) => setAuditorName(e.target.value)}
          />
        </div>
      </div>

      {/* Notes / Remarks Field */}
      <div className="velora-input-group" style={{ marginTop: '16px' }}>
        <label>Audit General Notes</label>
        <textarea
          rows={3}
          placeholder="Enter any additional audit comments or notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Checklist rendering for currently active location */}
      {selectedLocations.length > 0 && selectedLocations[currentEditingLocation] && (
        <div style={{ marginTop: '24px' }}>
          <div className="velora-section-header">
            <h3>
              Auditing Spot: {selectedLocations[currentEditingLocation].displayName}
            </h3>
          </div>

          {(() => {
            const obsList = auditResponses[selectedLocations[currentEditingLocation].key]?.observations || [];
            const total = obsList.length * 3;
            const answered = obsList.reduce(
              (sum, obs) => sum + ['floors', 'furniture', 'walls'].filter((k) => obs[k]?.response != null).length,
              0,
            );
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            if (total === 0) return null;
            return (
              <div style={{ margin: '8px 0 16px', fontSize: '0.8rem', color: 'var(--velora-text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{answered} of {total} checklist items answered in this spot</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--velora-border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--velora-primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(auditResponses[selectedLocations[currentEditingLocation].key]?.observations || []).map((obs, obsIdx) => (
              <div className="velora-observation-card" key={obs.id}>
                <div className="velora-observation-header">
                  <h4>Observation #{obsIdx + 1}</h4>
                  <button
                    className="velora-btn-danger"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                    onClick={() => removeObservation(selectedLocations[currentEditingLocation].key, obs.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className="velora-observation-body">
                  
                  {/* Item 1: Floors */}
                  <div className="velora-checklist-row">
                    <label className="item-title">Floors and Surfaces</label>
                    <div className="velora-response-options">
                      {['Acceptable', 'Needs Improvement', 'Unacceptable'].map((choice) => {
                        const styleKey = choice.replace(' ', '');
                        const isSelected = obs.floors.response === choice;
                        return (
                          <label
                            key={choice}
                            className={`velora-response-option ${isSelected ? `selected-${styleKey}` : ''}`}
                          >
                            <input
                              type="radio"
                              name={`floors_${obs.id}`}
                              value={choice}
                              checked={isSelected}
                              onChange={() => updateItemResponse(selectedLocations[currentEditingLocation].key, obs.id, 'floors', choice)}
                            />
                            {choice === 'Acceptable' && '✅ '}
                            {choice === 'Needs Improvement' && '⚠️ '}
                            {choice === 'Unacceptable' && '❌ '}
                            {choice}
                          </label>
                        );
                      })}
                    </div>
                    {['Needs Improvement', 'Unacceptable'].includes(obs.floors.response) && (
                      <div className="velora-defect-fields">
                        <div className="velora-input-group">
                          <label>Observation / Comment (required)</label>
                          <textarea
                            rows={2}
                            placeholder="Describe floor defect..."
                            value={obs.floors.comment || ''}
                            onChange={(e) => updateItemComment(selectedLocations[currentEditingLocation].key, obs.id, 'floors', e.target.value)}
                          />
                        </div>
                        <div className="velora-input-group">
                          <label>Evidence Photos (required, max 5)</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                handleFileUpload(selectedLocations[currentEditingLocation].key, obs.id, 'floors', e.target.files);
                                e.target.value = '';
                              }}
                            />
                            <button
                              className="velora-btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => handleAddCameraPhoto(selectedLocations[currentEditingLocation].key, obs.id, 'floors')}
                            >
                              <Camera size={12} /> Take Photo
                            </button>
                          </div>
                          <div className="velora-image-preview-container">
                            {obs.floors.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="velora-image-preview">
                                <img src={img} alt="Evidence" />
                                <div
                                  className="velora-remove-image"
                                  onClick={() => removeImage(selectedLocations[currentEditingLocation].key, obs.id, 'floors', imgIdx)}
                                >
                                  ×
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Item 2: Furniture */}
                  <div className="velora-checklist-row">
                    <label className="item-title">Furniture Fixtures and Blinds</label>
                    <div className="velora-response-options">
                      {['Acceptable', 'Needs Improvement', 'Unacceptable'].map((choice) => {
                        const styleKey = choice.replace(' ', '');
                        const isSelected = obs.furniture.response === choice;
                        return (
                          <label
                            key={choice}
                            className={`velora-response-option ${isSelected ? `selected-${styleKey}` : ''}`}
                          >
                            <input
                              type="radio"
                              name={`furniture_${obs.id}`}
                              value={choice}
                              checked={isSelected}
                              onChange={() => updateItemResponse(selectedLocations[currentEditingLocation].key, obs.id, 'furniture', choice)}
                            />
                            {choice === 'Acceptable' && '✅ '}
                            {choice === 'Needs Improvement' && '⚠️ '}
                            {choice === 'Unacceptable' && '❌ '}
                            {choice}
                          </label>
                        );
                      })}
                    </div>
                    {['Needs Improvement', 'Unacceptable'].includes(obs.furniture.response) && (
                      <div className="velora-defect-fields">
                        <div className="velora-input-group">
                          <label>Observation / Comment (required)</label>
                          <textarea
                            rows={2}
                            placeholder="Describe furniture defect..."
                            value={obs.furniture.comment || ''}
                            onChange={(e) => updateItemComment(selectedLocations[currentEditingLocation].key, obs.id, 'furniture', e.target.value)}
                          />
                        </div>
                        <div className="velora-input-group">
                          <label>Evidence Photos (required, max 5)</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                handleFileUpload(selectedLocations[currentEditingLocation].key, obs.id, 'furniture', e.target.files);
                                e.target.value = '';
                              }}
                            />
                            <button
                              className="velora-btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => handleAddCameraPhoto(selectedLocations[currentEditingLocation].key, obs.id, 'furniture')}
                            >
                              <Camera size={12} /> Take Photo
                            </button>
                          </div>
                          <div className="velora-image-preview-container">
                            {obs.furniture.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="velora-image-preview">
                                <img src={img} alt="Evidence" />
                                <div
                                  className="velora-remove-image"
                                  onClick={() => removeImage(selectedLocations[currentEditingLocation].key, obs.id, 'furniture', imgIdx)}
                                >
                                  ×
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Item 3: Walls */}
                  <div className="velora-checklist-row">
                    <label className="item-title">Walls, Doors and Windows</label>
                    <div className="velora-response-options">
                      {['Acceptable', 'Needs Improvement', 'Unacceptable'].map((choice) => {
                        const styleKey = choice.replace(' ', '');
                        const isSelected = obs.walls.response === choice;
                        return (
                          <label
                            key={choice}
                            className={`velora-response-option ${isSelected ? `selected-${styleKey}` : ''}`}
                          >
                            <input
                              type="radio"
                              name={`walls_${obs.id}`}
                              value={choice}
                              checked={isSelected}
                              onChange={() => updateItemResponse(selectedLocations[currentEditingLocation].key, obs.id, 'walls', choice)}
                            />
                            {choice === 'Acceptable' && '✅ '}
                            {choice === 'Needs Improvement' && '⚠️ '}
                            {choice === 'Unacceptable' && '❌ '}
                            {choice}
                          </label>
                        );
                      })}
                    </div>
                    {['Needs Improvement', 'Unacceptable'].includes(obs.walls.response) && (
                      <div className="velora-defect-fields">
                        <div className="velora-input-group">
                          <label>Observation / Comment (required)</label>
                          <textarea
                            rows={2}
                            placeholder="Describe wall defect..."
                            value={obs.walls.comment || ''}
                            onChange={(e) => updateItemComment(selectedLocations[currentEditingLocation].key, obs.id, 'walls', e.target.value)}
                          />
                        </div>
                        <div className="velora-input-group">
                          <label>Evidence Photos (required, max 5)</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                handleFileUpload(selectedLocations[currentEditingLocation].key, obs.id, 'walls', e.target.files);
                                e.target.value = '';
                              }}
                            />
                            <button
                              className="velora-btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => handleAddCameraPhoto(selectedLocations[currentEditingLocation].key, obs.id, 'walls')}
                            >
                              <Camera size={12} /> Take Photo
                            </button>
                          </div>
                          <div className="velora-image-preview-container">
                            {obs.walls.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="velora-image-preview">
                                <img src={img} alt="Evidence" />
                                <div
                                  className="velora-remove-image"
                                  onClick={() => removeImage(selectedLocations[currentEditingLocation].key, obs.id, 'walls', imgIdx)}
                                >
                                  ×
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}

            <button
              className="velora-add-observation-btn"
              onClick={() => addObservation(selectedLocations[currentEditingLocation].key)}
            >
              <Plus size={16} /> Add Observation
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
        <AutosaveStatus autosave={autosave} />
        <button
          className="velora-btn-secondary"
          onClick={saveDraft}
          disabled={loading || !serviceCategory || !serviceTypeId}
        >
          <Save size={16} /> {loading ? 'Saving...' : 'Save now'}
        </button>
        {selectedLocations.length > 0 && (
          <button
            className="velora-btn-primary"
            onClick={submitAudit}
            disabled={loading}
          >
            <CheckCircle size={16} /> {loading ? 'Submitting...' : 'Submit Audit'}
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. Drafts List Tab
// -----------------------------------------------------------------------------
function DraftsList({ loadDraft, loadOfflineDraft, activeTab, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOffline = () => {
    listOfflineDrafts('velora').then(setOfflineDrafts).catch(() => setOfflineDrafts([]));
  };

  const fetchDrafts = () => {
    setLoading(true);
    fetchOffline();
    api.get('/api/velora/drafts')
      .then(res => {
        if (res.data?.success) {
          setDrafts(res.data.data);
        }
      })
      // Offline (or a server hiccup) shouldn't nag — the device drafts below still show.
      .catch(err => { if (navigator.onLine) show('Failed to fetch drafts.', 'error'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrafts();
    const onOnline = () => fetchDrafts();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [activeTab]);

  const deleteOffline = async (localId) => {
    if (!(await confirm('Delete this draft from this device? It has not been synced to the server.'))) return;
    await deleteOfflineDraft(localId).catch(() => {});
    fetchOffline();
    show('Device draft deleted.', 'success');
  };

  const deleteDraft = async (id) => {
    if (!(await confirm('Are you sure you want to delete this draft?'))) return;
    try {
      const res = await api.delete(`/api/velora/drafts/${id}`);
      if (res.data?.success) {
        show('Draft deleted.', 'success');
        fetchDrafts();
      }
    } catch (err) {
      show('Failed to delete draft.', 'error');
    }
  };

  if (loading) return (
    <div className="velora-card">
      <div className="velora-card-title">
        <Save />
        Draft Audits
      </div>
      <ListSkeleton rows={3} />
    </div>
  );

  return (
    <div className="velora-card">
      <div className="velora-card-title">
        <Save />
        Draft Audits
      </div>

      {offlineDrafts.length > 0 && (
        <div>
          {offlineDrafts.map((d) => (
            <div key={d.localId} className="velora-draft-item">
              <div className="velora-item-info">
                <div className="velora-item-title">
                  {d.label || 'Unsynced audit'}
                  <span className="badge" style={{ marginLeft: '8px', color: 'var(--warn-fg)', background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
                    On this device · not synced
                  </span>
                </div>
                <div className="velora-item-meta">
                  <span><strong>Saved:</strong> {new Date(d.updatedAt).toLocaleString()}</span>
                  <span>Will sync automatically when back online.</span>
                </div>
              </div>
              <div className="velora-item-actions">
                <button className="velora-btn-secondary" onClick={() => loadOfflineDraft(d)}>
                  <ChevronRight size={14} /> Edit & Continue
                </button>
                <button className="velora-btn-danger" onClick={() => deleteOffline(d.localId)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {drafts.length === 0 && offlineDrafts.length === 0 ? (
        <div className="velora-empty-state">
          <Save size={40} />
          <div style={{ fontWeight: 600, marginTop: '8px' }}>No drafts yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
            Drafts you save while working through a service audit will show up here.
          </div>
          {onStartNew && (
            <button className="velora-btn-primary" style={{ marginTop: '16px' }} onClick={onStartNew}>
              Start a new audit
            </button>
          )}
        </div>
      ) : (
        <div>
          {drafts.map((d) => (
            <div key={d.id} className="velora-draft-item">
              <div className="velora-item-info">
                <div className="velora-item-title">Draft #{d.auditNumber}</div>
                <div className="velora-item-meta">
                  <span><strong>Category:</strong> {d.serviceCategory?.toUpperCase()}</span>
                  <span><strong>Date:</strong> {d.auditDate ? new Date(d.auditDate).toLocaleDateString() : 'Not Set'}</span>
                  <span><strong>Auditor:</strong> {d.auditorName || 'System'}</span>
                </div>
              </div>
              <div className="velora-item-actions">
                <button
                  className="velora-btn-secondary"
                  onClick={() => loadDraft(d)}
                >
                  <ChevronRight size={14} /> Edit & Continue
                </button>
                <button
                  className="velora-btn-danger"
                  onClick={() => deleteDraft(d.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. PDF Reports Tab
// -----------------------------------------------------------------------------
function ReportsList({ onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = () => {
    setLoading(true);
    api.get('/api/velora/pdf-reports')
      .then(res => {
        if (res.data?.success) {
          setReports(res.data.data);
        }
      })
      .catch(err => show('Failed to fetch PDF reports.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const downloadReport = async (id, fileName) => {
    try {
      const response = await api.get(`/api/velora/pdf-reports/download/${id}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      show('Failed to download PDF report.', 'error');
    }
  };

  const deleteReport = async (id) => {
    if (!(await confirm('Are you sure you want to delete this report?'))) return;
    try {
      const res = await api.delete(`/api/velora/pdf-reports/${id}`);
      if (res.data?.success) {
        show('Report deleted.', 'success');
        fetchReports();
      }
    } catch (err) {
      show('Failed to delete report.', 'error');
    }
  };

  if (loading) return (
    <div className="velora-card">
      <div className="velora-card-title">
        <FileText />
        Generated PDF Reports
      </div>
      <ListSkeleton rows={3} />
    </div>
  );

  return (
    <div className="velora-card">
      <div className="velora-card-title">
        <FileText />
        Generated PDF Reports
      </div>

      {reports.length === 0 ? (
        <div className="velora-empty-state">
          <FileText size={40} />
          <div style={{ fontWeight: 600, marginTop: '8px' }}>No PDF reports yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
            Generate a PDF from a submitted service audit and it will show up here.
          </div>
          {onStartNew && (
            <button className="velora-btn-primary" style={{ marginTop: '16px' }} onClick={onStartNew}>
              Go to Service Audit
            </button>
          )}
        </div>
      ) : (
        <div>
          {reports.map((r) => (
            <div key={r.id} className="velora-pdf-item">
              <div className="velora-item-info">
                <div className="velora-item-title">{r.title || `Report ${r.reportNumber}`}</div>
                <div className="velora-item-meta">
                  <span><strong>Audit Number:</strong> {r.auditNumber || 'N/A'}</span>
                  <span><strong>Report Code:</strong> {r.reportNumber}</span>
                  <span><strong>Generated:</strong> {new Date(r.generatedDate).toLocaleString()}</span>
                </div>
              </div>
              <div className="velora-item-actions">
                <button
                  className="velora-btn-primary"
                  onClick={() => downloadReport(r.id, r.fileName)}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  className="velora-btn-danger"
                  onClick={() => deleteReport(r.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5. Service Reports Tab
// -----------------------------------------------------------------------------
function ServiceReportsList() {
  const { user } = useAuth();
  const { show } = useToast();
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchServiceReports = () => {
    api.get('/api/velora/service-reports')
      .then(res => {
        if (res.data?.success) {
          setReports(res.data.data);
        }
      })
      .catch(err => show('Failed to fetch service reports.', 'error'));
  };

  useEffect(() => {
    fetchServiceReports();
  }, []);

  const handleGenerateReport = async () => {
    if (!reportType || !title) {
      show('Please fill out Report Type and Title.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        reportTypeId: parseInt(reportType, 10),
        reportDate,
        title,
        content,
        description: content,
        createdBy: user?.username || 'System'
      };

      const res = await api.post('/api/velora/service-reports', payload);
      if (res.data?.success) {
        show('Service report generated successfully.', 'success');
        setTitle('');
        setContent('');
        setReportType('');
        fetchServiceReports();
      }
    } catch (err) {
      show('Failed to generate report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadServiceReportPdf = async (report) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 18;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;
      let y = 58;

      const addHeader = (pageNum) => {
        doc.setPage(pageNum);
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 45, 'F');
        doc.line(margin, 45, pageWidth - margin, 45);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(24, 24, 27); // zinc-900
        doc.text('Service Report', pageWidth - margin, 25, { align: 'right' });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(228, 228, 231);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(113, 113, 122); // zinc-500

        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      };

      addHeader(1);

      // Section Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 24, 27);
      doc.text('REPORT DETAILS', margin, y);
      y += 8;

      // Report Info Card
      doc.setFillColor(250, 250, 250); // zinc-50
      doc.rect(margin, y - 2, contentWidth, 38, 'F');
      doc.setDrawColor(228, 228, 231); // zinc-200
      doc.rect(margin, y - 2, contentWidth, 38);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(63, 63, 70); // zinc-700

      const typeLabel = report.reportTypeId === 1 ? 'Periodical Report' : report.reportTypeId === 2 ? 'Incident Report' : 'Service Report';
      doc.text(`Report Type: ${typeLabel}`, margin + 6, y + 6);
      doc.text(`Report Number: ${report.reportNumber}`, margin + 6, y + 14);
      doc.text(`Report Date: ${new Date(report.reportDate).toLocaleDateString()}`, margin + 6, y + 22);
      doc.text(`Created By: ${report.createdBy || 'System'}`, margin + 6, y + 30);
      y += 48;

      // Report Content Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 24, 27);
      doc.text(report.title.toUpperCase(), margin, y);
      y += 6;

      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(0.4);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 8;

      // Report Content Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(39, 39, 42); // zinc-800

      if (report.content) {
        const splitContent = doc.splitTextToSize(report.content, contentWidth);
        
        for (let line of splitContent) {
          if (y > 260) {
            doc.addPage();
            addHeader(doc.internal.getNumberOfPages());
            y = 58;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(39, 39, 42);
          }
          doc.text(line, margin, y);
          y += 5.5;
        }
      } else {
        doc.text('No content provided for this report.', margin, y);
      }

      // Add correct page numbers/headers dynamically for all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        addHeader(i);
      }

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${report.reportNumber}_Service_Report.pdf`;
      link.click();
      URL.revokeObjectURL(pdfUrl);
    } catch (err) {
      show('Failed to download Service Report PDF.', 'error');
    }
  };

  return (
    <div>
      <div className="velora-card">
        <div className="velora-card-title">
          <FileSpreadsheet />
          Generate Service Report
        </div>
        <div className="velora-form-grid">
          <div className="velora-input-group">
            <label>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="">Select Type</option>
              <option value="1">Periodical Report</option>
              <option value="2">Incident Reports</option>
              <option value="3">Service Reports</option>
            </select>
          </div>
          <div className="velora-input-group">
            <label>Report Date</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div className="velora-input-group">
            <label>Report Title</label>
            <input
              type="text"
              placeholder="Enter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <div className="velora-input-group" style={{ marginBottom: '20px' }}>
          <label>Content</label>
          <textarea
            rows={5}
            placeholder="Enter report content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <button
          className="velora-btn-primary"
          onClick={handleGenerateReport}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      <div className="velora-card">
        <div className="velora-card-title">
          <FileSpreadsheet />
          Report Archive
        </div>
        {reports.length === 0 ? (
          <div className="velora-empty-state">No reports found</div>
        ) : (
          <div>
            {reports.map((r) => (
              <div key={r.id} className="velora-pdf-item">
                <div className="velora-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div className="velora-item-title">{r.title}</div>
                    <div className="velora-badge" style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px' }}>
                      {r.reportTypeId === 1 ? 'Periodical' : r.reportTypeId === 2 ? 'Incident' : 'Service'}
                    </div>
                  </div>
                  <div className="velora-item-meta" style={{ marginTop: '6px' }}>
                    <span><strong>Report Number:</strong> {r.reportNumber}</span>
                    <span><strong>Date:</strong> {new Date(r.reportDate).toLocaleDateString()}</span>
                    <span><strong>Author:</strong> {r.createdBy || 'System'}</span>
                  </div>
                  {r.content && (
                    <div style={{ fontSize: '0.85rem', marginTop: '12px', borderTop: '1px solid var(--zinc-200)', paddingTop: '10px', color: 'var(--zinc-700)', whiteSpace: 'pre-wrap' }}>
                      {r.content}
                    </div>
                  )}
                </div>
                <div className="velora-item-actions" style={{ alignSelf: 'flex-start' }}>
                  <button
                    className="velora-btn-secondary"
                    onClick={() => downloadServiceReportPdf(r)}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 6. Compliance Tab Component
// -----------------------------------------------------------------------------
function ComplianceList() {
  const { show } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('compliant');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [evidence, setEvidence] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDeliveries = () => {
    api.get('/api/velora/compliance/delivery')
      .then(res => {
        if (res.data?.success) {
          setDeliveries(res.data.data);
        }
      })
      .catch(err => show('Failed to fetch compliance list.', 'error'));
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setCategory(val);
    setItemId('');
    setItems([]);

    if (val) {
      api.get(`/api/velora/compliance/items/${val}`)
        .then(res => {
          if (res.data?.success) {
            setItems(res.data.data);
          }
        })
        .catch(err => show('Failed to fetch compliance items.', 'error'));
    }
  };

  const handleSaveCompliance = async () => {
    if (!itemId || !deliveryDate) {
      show('Please select compliance item and delivery date.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        complianceItemId: parseInt(itemId, 10),
        deliveryDate,
        status,
        evidence,
        verifiedBy,
        verificationDate
      };

      const res = await api.post('/api/velora/compliance/delivery', payload);
      if (res.data?.success) {
        show('Compliance record saved successfully.', 'success');
        setCategory('');
        setItemId('');
        setEvidence('');
        setVerifiedBy('');
        fetchDeliveries();
      }
    } catch (err) {
      show('Failed to save compliance.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadCompliancePdf = async (record) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 18;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;
      let y = 58;

      const addHeader = (pageNum) => {
        doc.setPage(pageNum);
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 45, 'F');
        doc.line(margin, 45, pageWidth - margin, 45);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(24, 24, 27); // zinc-900
        doc.text('Compliance Report', pageWidth - margin, 25, { align: 'right' });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(228, 228, 231);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(113, 113, 122); // zinc-500

        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      };

      addHeader(1);

      // Section Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 24, 27);
      doc.text('COMPLIANCE RECORD DETAILS', margin, y);
      y += 8;

      // Info Card
      doc.setFillColor(250, 250, 250); // zinc-50
      doc.rect(margin, y - 2, contentWidth, 42, 'F');
      doc.setDrawColor(228, 228, 231); // zinc-200
      doc.rect(margin, y - 2, contentWidth, 42);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(63, 63, 70); // zinc-700

      doc.text(`Category: ${record.category_name}`, margin + 6, y + 6);
      doc.text(`Compliance Item: ${record.item_name}`, margin + 6, y + 14);
      doc.text(`Delivery Date: ${new Date(record.deliveryDate).toLocaleDateString()}`, margin + 6, y + 22);
      
      const statusText = record.status === 'compliant' ? 'Compliant' : record.status === 'partial' ? 'Partial' : 'Non-Compliant';
      doc.text(`Status: ${statusText}`, margin + 6, y + 30);
      
      let statusColor = [153, 27, 27]; // red
      if (record.status === 'compliant') statusColor = [22, 101, 52]; // green
      else if (record.status === 'partial') statusColor = [133, 77, 14]; // amber
      
      doc.setFillColor(...statusColor);
      doc.circle(margin + 6 + doc.getTextWidth(`Status: ${statusText}`) + 4.2, y + 28.5, 1.2, 'F');

      y += 52;

      // Verification Details Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 24, 27);
      doc.text('VERIFICATION DETAILS', margin, y);
      y += 6;

      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(0.4);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(39, 39, 42);

      doc.text(`Verified By: ${record.verifiedBy || 'N/A'}`, margin, y);
      y += 8;
      doc.text(`Verification Date: ${record.verificationDate ? new Date(record.verificationDate).toLocaleDateString() : 'N/A'}`, margin, y);
      y += 12;

      // Evidence / Notes Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 24, 27);
      doc.text('EVIDENCE & NOTES', margin, y);
      y += 6;

      doc.setDrawColor(24, 24, 27);
      doc.setLineWidth(0.4);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(39, 39, 42);

      if (record.evidence) {
        const splitEvidence = doc.splitTextToSize(record.evidence, contentWidth);
        for (let line of splitEvidence) {
          if (y > 260) {
            doc.addPage();
            addHeader(doc.internal.getNumberOfPages());
            y = 58;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(39, 39, 42);
          }
          doc.text(line, margin, y);
          y += 5.5;
        }
      } else {
        doc.text('No notes or evidence records provided.', margin, y);
      }

      // Add correct header footers dynamically for all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        addHeader(i);
      }

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Compliance_Report_${record.id}.pdf`;
      link.click();
      URL.revokeObjectURL(pdfUrl);
    } catch (err) {
      show('Failed to download Compliance PDF.', 'error');
    }
  };

  return (
    <div>
      <div className="velora-card">
        <div className="velora-card-title">
          <ShieldCheck />
          Compliance Delivery Record
        </div>
        <div className="velora-form-grid">
          <div className="velora-input-group">
            <label>Category</label>
            <select value={category} onChange={handleCategoryChange}>
              <option value="">Select Category</option>
              <option value="1">Resources</option>
              <option value="2">Safety Practice</option>
              <option value="3">Training and Certification</option>
            </select>
          </div>
          <div className="velora-input-group">
            <label>Compliance Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              disabled={!category}
            >
              <option value="">{category ? 'Select Item' : 'Select category first'}</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.itemName}</option>)}
            </select>
          </div>
          <div className="velora-input-group">
            <label>Delivery Date</label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>
        <div className="velora-form-grid" style={{ marginTop: '16px' }}>
          <div className="velora-input-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="compliant">✅ Compliant</option>
              <option value="partial">⚠️ Partial</option>
              <option value="non_compliant">❌ Non-Compliant</option>
            </select>
          </div>
          <div className="velora-input-group">
            <label>Verified By</label>
            <input
              type="text"
              placeholder="Verifier name"
              value={verifiedBy}
              onChange={(e) => setVerifiedBy(e.target.value)}
            />
          </div>
          <div className="velora-input-group">
            <label>Verification Date</label>
            <input type="date" value={verificationDate} onChange={(e) => setVerificationDate(e.target.value)} />
          </div>
        </div>
        <div className="velora-input-group" style={{ margin: '16px 0' }}>
          <label>Evidence / Notes</label>
          <textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </div>
        <button
          className="velora-btn-primary"
          onClick={handleSaveCompliance}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Compliance Record'}
        </button>
      </div>

      <div className="velora-card">
        <div className="velora-card-title">
          <ShieldCheck />
          Compliance History
        </div>
        {deliveries.length === 0 ? (
          <div className="velora-empty-state">No compliance records found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="velora-data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Verified By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.item_name}</td>
                    <td>{c.category_name}</td>
                    <td>{new Date(c.deliveryDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`velora-status-badge velora-status-${c.status}`}>
                        {c.status === 'compliant' && 'Compliant'}
                        {c.status === 'partial' && 'Partial'}
                        {c.status === 'non_compliant' && 'Non-Compliant'}
                      </span>
                    </td>
                    <td>{c.verifiedBy || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="velora-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => downloadCompliancePdf(c)}
                      >
                        <Download size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
