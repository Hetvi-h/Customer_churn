import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Brain,
  TrendingUp,
  PieChart,
  Settings,
  Activity,
  AlertTriangle,
  Menu,
  X,
  Upload,
  Home as HomeIcon,
  Zap,
  LogOut
} from 'lucide-react';
import { useState } from 'react';
import { useUpload } from '../contexts/UploadContext';
import { useAuth } from '../contexts/AuthContext';

// Navigation items BEFORE upload
const preUploadNavigation = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Upload Data', href: '/upload', icon: Upload },
];

// Navigation items AFTER upload
const postUploadNavigation = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Upload Data', href: '/upload', icon: Upload },
  { name: 'divider', isDivider: true },
  { name: 'Customer Intelligence', href: '/customers', icon: Brain },
  { name: 'Segments', href: '/segments', icon: PieChart },
  { name: 'Trends', href: '/trends', icon: TrendingUp },
  { name: 'Feature Drivers', href: '/features', icon: Zap },
  { name: 'Model Metrics', href: '/model-metrics', icon: Activity },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { hasUploadedData, resetUpload } = useUpload();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    resetUpload(); // Clear the upload context state and localStorage
    logout();
    navigate('/login', { replace: true });
  };

  // Choose navigation based on upload state
  const navigation = hasUploadedData ? postUploadNavigation : preUploadNavigation;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
          <span className="text-xl font-bold text-white">Churn Predict</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="mt-4 px-2">
          {navigation.map((item, index) => {
            if (item.isDivider) {
              return <div key={`divider-${index}`} className="border-t border-gray-700 my-2"></div>;
            }

            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 mb-1 rounded-lg transition-colors ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-900">
          <div className="flex items-center h-16 px-4 bg-gray-800">
            <AlertTriangle className="w-8 h-8 text-primary-500 mr-2" />
            <span className="text-xl font-bold text-white">Churn Predict</span>
          </div>
          <nav className="flex-1 mt-4 px-2">
            {navigation.map((item, index) => {
              if (item.isDivider) {
                return <div key={`divider-${index}`} className="border-t border-gray-700 my-2"></div>;
              }

              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 mb-1 rounded-lg transition-colors ${isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center text-gray-400 text-sm">
              <Settings className="w-4 h-4 mr-2" />
              v2.1.0 - Streamlined
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between h-16 bg-white shadow-sm px-4 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="ml-4 lg:ml-0 text-xl font-semibold text-gray-800">
              {navigation.find((n) => n.href === location.pathname)?.name || 'Churn Prediction'}
            </h1>
          </div>
          {/* User avatar + logout */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="View profile"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="hidden sm:block text-sm text-gray-700 font-medium max-w-[120px] truncate">
                  {user.name || user.email}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </div>
          )}
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
