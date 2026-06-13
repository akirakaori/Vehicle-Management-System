import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { AdminDashboard } from './pages/AdminDashboard';
import { 
  CustomerOverview, 
  VehiclesPage, 
  AppointmentsPage, 
  BookingPage, 
  RequestsPage, 
  NewRequestPage, 
  HistoryPage 
} from './pages/CustomerDashboard';
import { CustomerHomePage } from './pages/CustomerHomePage';
import CustomerLayout from './components/customer/CustomerLayout';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';
import VendorPage from './pages/vendors/VendorPage';
import PartsPage from './pages/parts/PartsPage';
import { useToast } from './context/ToastContext';
import { apiFetch, authApi, clearStoredUser, getStoredUser, saveStoredUser } from './services/api';

// Staff Section Components
import StaffLayout from './components/staff/StaffLayout';
import Dashboard from './pages/staff/Dashboard';
import Customers from './pages/staff/Customers';
import CustomerSegments from './pages/staff/CustomerSegments';
import CustomerDetail from './pages/staff/CustomerDetail';
import Sales from './pages/staff/Sales';
import Invoices from './pages/staff/Invoices';
import InvoiceDetail from './pages/staff/InvoiceDetail';
import Inventory from './pages/staff/Inventory';
import Appointments from './pages/staff/Appointments';

import './index.css';

const ROLES = { ADMIN: 'Admin', STAFF: 'Staff', CUSTOMER: 'Customer' };

function App() {
  const showToast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [staffList, setStaffList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const isLoggingOut = useRef(false);

  const handleInventoryUpdate = (nextInventory) => {
    setInventory(nextInventory);
    window.dispatchEvent(new CustomEvent('vis:inventory-changed'));
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      // Don't show error if user is intentionally logging out show if not only 
      if (isLoggingOut.current) {
        return;
      }
      setUser(null);
      clearStoredUser();
      navigate('/login');
      showToast('error', 'Your session has expired. Please log in again.');
    };

    window.addEventListener('vis:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('vis:unauthorized', handleUnauthorized);
  }, [navigate, showToast]);

  useEffect(() => {
    if (user) {
      loadAllData(user);
    }
  }, [user]);

  const loadAllData = async (activeUser = user) => {
    if (!activeUser) return;
    setIsLoading(true);
    try {
      if (activeUser.role === ROLES.ADMIN || activeUser.role === ROLES.STAFF) {
        const [partsRes, salesRes] = await Promise.all([
          apiFetch('/parts'),
          apiFetch('/Transactions/sales')
        ]);

        const parts = Array.isArray(partsRes) ? partsRes : [];
        handleInventoryUpdate(parts.map((p) => ({
          id: p.id ?? p.Id,
          name: p.name ?? p.Name ?? '',
          stock: p.stockLevel ?? p.StockLevel ?? 0,
          stockLevel: p.stockLevel ?? p.StockLevel ?? 0,
          price: p.price ?? p.Price ?? 0,
          vendorId: p.vendorId ?? p.VendorId ?? 0,
          vendorName: p.vendorName ?? p.VendorName ?? '',
          vendor: p.vendorName ?? p.VendorName ?? 'Unknown Vendor',
          partCode: p.partCode ?? p.PartCode ?? ''
        })));

        let salesArray = salesRes;
        if (salesRes && !Array.isArray(salesRes)) {
          salesArray = salesRes.data || salesRes.items || salesRes.transactions || salesRes.results || salesRes.value || [];
        }
        const sales = Array.isArray(salesArray) ? salesArray : [];
        setSalesHistory(sales.map((s) => ({
          id: s.id,
          customerName: s.customerName,
          total: s.totalAmount,
          date: s.date,
          paymentStatus: s.paymentStatus,
          items: s.items || s.Items || s.transactionItems || s.TransactionItems || []
        })));
      }

      if (activeUser.role === ROLES.ADMIN) {
        const usersRes = await apiFetch('/users');
        const users = Array.isArray(usersRes) ? usersRes : [];
        setStaffList(users.filter((u) => u.role === 'Admin' || u.role === 'Staff'));
        setCustomerList(users.filter((u) => u.role === 'Customer').map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phoneNumber || '',
          isActive: c.isActive,
          plate: c.vehicles?.length > 0 ? c.vehicles[0].plateNumber : 'N/A',
          vehicleInfo: c.vehicles?.length > 0 ? c.vehicles[0] : null
        })));
      } else if (activeUser.role === ROLES.STAFF) {
        const [custsRes, apptsRes] = await Promise.all([
          apiFetch('/users/customers'),
          apiFetch('/Service/appointments')
        ]);
        const customers = Array.isArray(custsRes) ? custsRes : [];
        setCustomerList(customers.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phoneNumber || '',
          isActive: c.isActive,
          plate: c.vehicles?.length > 0 ? c.vehicles[0].plateNumber : 'N/A',
          vehicleInfo: c.vehicles?.length > 0 ? c.vehicles[0] : null
        })));
        // Normalize paginated or array responses so `appointments` is always an array
        const apptsArray = Array.isArray(apptsRes)
          ? apptsRes
          : (apptsRes && (apptsRes.items || apptsRes.Items || apptsRes.data))
            ? (apptsRes.items || apptsRes.Items || apptsRes.data)
            : [];
        setAppointments(apptsArray);
      } else if (activeUser.role === ROLES.CUSTOMER) {
        handleInventoryUpdate([]);
        setSalesHistory([]);
      }

      if (activeUser.role === ROLES.ADMIN || activeUser.role === ROLES.STAFF) {
        try {
          await apiFetch('/reports/send-unpaid-reminders', { method: 'POST' });
        } catch (error) {
          console.error('Overdue reminder check failed:', error);
        }
      }
    } catch (error) {
      console.error('Data load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    isLoggingOut.current = true;
    clearStoredUser();
    setUser(null);
    navigate('/login', { replace: true });
  };

  const handleLogin = async (loggedInUser) => {
    saveStoredUser(loggedInUser);
    setUser(loggedInUser);
    const path = loggedInUser.role === ROLES.STAFF ? '/staff/dashboard' : (loggedInUser.role === ROLES.ADMIN ? '/admin' : '/customer/home');
    navigate(path);
  };

  const handleProcessSale = async (customerId, cartItems, paymentStatus, vehicleId = null) => {
    try {
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const salePayload = {
        customerId: parseInt(customerId, 10),
        vehicleId: vehicleId || null,
        totalAmount,
        paymentStatus,
        items: cartItems.map(item => ({ partId: item.id, quantity: item.quantity, unitPrice: item.price }))
      };
      const response = await apiFetch('/Transactions/sale', { method: 'POST', body: JSON.stringify(salePayload) });
      showToast('success', `Sale #${response.id} processed successfully!`);
      await loadAllData(); // Refresh inventory and sales history
    } catch (err) {
      showToast('error', err.message || 'Failed to process sale.');
    }
  };

  const handleAddStaff = async (staffPayload) => {
    try {
      await authApi.createStaff(staffPayload);
      showToast('success', 'Staff member created successfully.');
      await loadAllData(user);
      return true;
    } catch (error) {
      showToast('error', error.message || 'Failed to create staff member.');
      return false;
    }
  };

  const handleAddCustomer = async (customerData) => {
    try {
      const response = await authApi.registerCustomer(customerData);
      showToast('success', 'Registration successful! Please log in with your credentials.');
      return response;
    } catch (error) {
      showToast('error', error.message || 'Failed to register customer.');
      return null;
    }
  };

  const handleUpdateStaff = async (updatePayload) => {
    try {
      const response = await authApi.updateUser(updatePayload.id, {
        name: updatePayload.name,
        email: updatePayload.email,
        phoneNumber: updatePayload.phone,
        role: updatePayload.role,
        isActive: updatePayload.isActive
      });
      showToast('success', 'Staff member updated successfully.');
      setStaffList((current) =>
        current.map((staff) => (staff.id === updatePayload.id ? { ...staff, ...updatePayload } : staff))
      );
      return true;
    } catch (error) {
      showToast('error', error.message || 'Failed to update staff member.');
      return false;
    }
  };

  const handleRemoveStaff = async (staffId) => {
    try {
      await authApi.toggleUserStatus(staffId);
      showToast('success', 'Staff member removed successfully.');
      setStaffList((current) => current.map((staff) => staff.id === staffId ? { ...staff, isActive: !staff.isActive } : staff));
    } catch (error) {
      showToast('error', error.message || 'Failed to remove staff member.');
    }
  };

  const handleUpdateCustomer = (updatedCustomer) => {
    setCustomerList((current) =>
      current.map((customer) => (customer.id === updatedCustomer.id ? { ...customer, ...updatedCustomer } : customer))
    );
  };

  const handleRemoveCustomer = async (customerId) => {
    try {
      await authApi.toggleUserStatus(customerId);
      setCustomerList((current) => current.map((customer) => customer.id === customerId ? { ...customer, isActive: !customer.isActive } : customer));
    } catch (error) {
      showToast('error', error.message || 'Failed to remove customer.');
      throw error;
    }
  };

  const isStaffSection = location.pathname.startsWith('/staff');
  const isCustomerSection = location.pathname.startsWith('/customer');
  const isAdminPortalSection =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/vendors') ||
    location.pathname.startsWith('/parts');
  const hideGlobalNav = isStaffSection || isCustomerSection || isAdminPortalSection;

  return (
    <div className="app-container">
      {!hideGlobalNav && user && <Header user={user} onLogout={logout} onNavigateStaff={() => navigate('/staff/dashboard')} />}
      
      <main className={hideGlobalNav ? "" : "main-content"}>

        <Routes>
          <Route path="/" element={user ? <Navigate to={user.role === ROLES.STAFF ? "/staff/dashboard" : (user.role === ROLES.ADMIN ? "/admin" : "/customer")} /> : <LandingPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} onSignUp={() => navigate('/signup')} onForgotPassword={() => navigate('/forgot-password')} />} />
          <Route path="/signup" element={<SignupPage onAddCustomer={handleAddCustomer} />} />
          
          {/* Staff Section with Layout Overhaul */}
          {user?.role === ROLES.STAFF && (
            <Route path="/staff" element={<StaffLayout user={user} onLogout={logout} />}>
              <Route index element={<Navigate to="dashboard" />} />
              <Route path="dashboard" element={<Dashboard sales={salesHistory} customers={customerList} parts={inventory} appointments={appointments} />} />
              <Route path="customers/segments" element={<CustomerSegments />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="customers" element={<Customers />} />
              <Route path="sales/new" element={<Sales customers={customerList} parts={inventory} onProcessSale={handleProcessSale} />} />
              <Route path="transactions" element={<Invoices />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="parts" element={<Inventory />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="settings" element={<SettingsPage user={user} />} />
            </Route>
          )}

          {/* Admin Section with Layout Overhaul */}
          {user?.role === ROLES.ADMIN && (
            <Route path="/admin" element={<StaffLayout user={user} onLogout={logout} />}>
              <Route index element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="main"
                />
              } />
              <Route path="staff/add" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="add-staff"
                />
              } />
              <Route path="staff" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="view-all-staff"
                />
              } />
              <Route path="customers" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="manage-customers"
                />
              } />
              <Route path="inventory/purchase" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="manage-inventory"
                />
              } />
              <Route path="inventory" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="view-all-inventory"
                />
              } />
              <Route path="transactions" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={handleInventoryUpdate}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="purchases"
                />
              } />
              <Route path="purchases" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={setInventory}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="purchases"
                />
              } />
              <Route path="reports" element={
                <AdminDashboard
                  staffList={staffList}
                  onAddStaff={handleAddStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onRemoveStaff={handleRemoveStaff}
                  sales={salesHistory}
                  inventory={inventory}
                  onUpdateInventory={setInventory}
                  customerList={customerList}
                  onRemoveCustomer={handleRemoveCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenVendorManagement={() => navigate('/vendors')}
                  view="reports"
                />
              } />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="settings" element={<SettingsPage user={user} />} />

            </Route>
          )}

          {/* Customer Section with Layout Overhaul */}

          {user?.role === ROLES.CUSTOMER && (
            <>
              <Route path="/customer/home" element={<CustomerHomePage user={user} onLogout={logout} />} />
              <Route path="/customer" element={<CustomerLayout user={user} onLogout={logout} />}>
                <Route index element={<CustomerOverview user={user} />} />
                <Route path="vehicles" element={<VehiclesPage user={user} />} />
                <Route path="appointments" element={<AppointmentsPage user={user} />} />
                <Route path="book" element={<BookingPage user={user} />} />
                <Route path="requests" element={<RequestsPage user={user} />} />
                <Route path="new-request" element={<NewRequestPage user={user} />} />
                <Route path="history" element={<HistoryPage user={user} />} />
                <Route path="settings" element={<SettingsPage user={user} />} />
              </Route>
            </>
          )}
          <Route path="/parts" element={user?.role === ROLES.ADMIN ? <StaffLayout user={user} onLogout={logout} /> : <Navigate to="/" />}>
            <Route index element={<PartsPage />} />
          </Route>
          <Route path="/vendors" element={user?.role === ROLES.ADMIN ? <StaffLayout user={user} onLogout={logout} /> : <Navigate to="/" />}>
            <Route index element={<VendorPage />} />
          </Route>
          
          <Route path="/forgot-password" element={<ForgotPasswordPage onContinue={() => navigate('/verify-otp')} onBack={() => navigate('/login')} />} />
          <Route path="/verify-otp" element={<VerifyOtpPage onContinue={() => navigate('/reset-password')} onBack={() => navigate('/forgot-password')} />} />
          <Route path="/reset-password" element={<ResetPasswordPage onComplete={() => navigate('/login')} onBack={() => navigate('/verify-otp')} />} />
        </Routes>
      </main>

      {!hideGlobalNav && user && <Footer />}
    </div>
  );
}

export default App;
