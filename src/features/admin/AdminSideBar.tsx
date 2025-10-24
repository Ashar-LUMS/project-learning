import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Shield,
  ChevronLeft,
  ChevronRight,
  UserCog,
  FolderKanban
} from 'lucide-react';

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed = false, onToggle }) => {
  const location = useLocation();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/app/admin'
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      path: '/app/admin/users'
    },
    {
      id: 'role',
      label: 'Roles',
      icon: UserCog,
      path: '/app/admin/role-management'
    },
    {
      id: 'project',
      label: 'Projects',
      icon: FolderKanban,
      path: '/app/admin/project-management'
    },
    // {
    //   id: 'content',
    //   label: 'Content',
    //   icon: FileText,
    //   path: '/app/admin/content'
    // },
    // {
    //   id: 'security',
    //   label: 'Security',
    //   icon: Shield,
    //   path: '/app/admin/security'
    // },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/app/admin/settings'
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className={`bg-white border-r border-gray-200 h-full flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-gray-900">Admin Panel</span>
          </div>
        )}
        {collapsed && (
          <Shield className="h-6 w-6 text-blue-600 mx-auto" />
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                active 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon 
                size={20} 
                className={`flex-shrink-0 ${
                  active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                }`} 
              />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 text-center">
            Admin Access Only
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSidebar;