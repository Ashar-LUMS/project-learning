import { 
  Users, 
  Shield, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const AdminDashboard = () => {
  const [statsData, setStatsData] = useState({
    totalUsers: 0,
    adminUsers: 0,
    activeSessions: 0,
    lockedAccounts: 0,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users data
        const { data: users, error: usersError } = await supabase.rpc("get_users_as_admin");
        if (usersError) throw usersError;

        const totalUsers = users?.length || 0;
        const adminUsers = users?.filter((user: any) => 
          user.raw_user_meta_data?.roles?.includes('Admin')
        ).length || 0;
        const lockedAccounts = users?.filter((user: any) => 
          user.raw_user_meta_data?.isLocked
        ).length || 0;

        // For active sessions, we'll use a simple approximation based on recent sign-ins
        // You might want to implement a more sophisticated session tracking
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const activeSessions = users?.filter((user: any) => 
          user.last_sign_in_at && new Date(user.last_sign_in_at) > oneDayAgo
        ).length || 0;

        setStatsData({
          totalUsers,
          adminUsers,
          activeSessions,
          lockedAccounts,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStatsData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  const stats = [
    {
      title: 'Total Users',
      value: statsData.loading ? '...' : statsData.totalUsers.toString(),
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'blue',
      description: 'Registered users'
    },
    {
      title: 'Admin Users',
      value: statsData.loading ? '...' : statsData.adminUsers.toString(),
      change: '+2',
      trend: 'up',
      icon: Shield,
      color: 'purple',
      description: 'Administrators'
    },
    {
      title: 'Active Sessions',
      value: statsData.loading ? '...' : statsData.activeSessions.toString(),
      change: '-5%',
      trend: 'down',
      icon: Activity,
      color: 'green',
      description: 'Signed in today'
    },
    {
      title: 'Locked Accounts',
      value: statsData.loading ? '...' : statsData.lockedAccounts.toString(),
      change: '+1',
      trend: 'up',
      icon: AlertTriangle,
      color: 'red',
      description: 'Requires attention'
    }
  ];

  const recentActivities = [
    {
      id: 1,
      user: 'John Doe',
      action: 'Role updated',
      target: 'Admin',
      time: '2 minutes ago',
      status: 'success'
    },
    {
      id: 2,
      user: 'Sarah Wilson',
      action: 'Account locked',
      target: 'User',
      time: '15 minutes ago',
      status: 'warning'
    },
    {
      id: 3,
      user: 'Mike Chen',
      action: 'Role updated',
      target: 'Editor',
      time: '1 hour ago',
      status: 'success'
    },
    {
      id: 4,
      user: 'Emily Davis',
      action: 'Account unlocked',
      target: 'User',
      time: '2 hours ago',
      status: 'success'
    }
  ];

  const systemStatus = {
    database: 'operational',
    api: 'operational',
    authentication: 'operational',
    storage: 'degraded'
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'down': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle2 className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'down': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          {statsData.loading && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
        </div>
        <p className="text-gray-600 mt-2">Overview of system statistics and recent activities</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'text-blue-600 bg-blue-50',
            purple: 'text-purple-600 bg-purple-50',
            green: 'text-green-600 bg-green-50',
            red: 'text-red-600 bg-red-50'
          }[stat.color];

          return (
            <div key={stat.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <div className="flex items-center mt-2">
                    {statsData.loading ? (
                      <div className="flex items-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
                        <span className="text-2xl font-bold text-gray-400">Loading...</span>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    )}
                  </div>
                  {!statsData.loading && (
                    <div className="flex items-center mt-1">
                      <TrendingUp className={`w-4 h-4 ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
                      <span className={`text-sm font-medium ml-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">from last week</span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{stat.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </button>
          </div>
          
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-full ${
                  activity.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                }`}>
                  {activity.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.user}
                    </p>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {activity.action} • <span className="font-medium">{activity.target}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">System Status</h2>
          
          <div className="space-y-4">
            {Object.entries(systemStatus).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {service}
                    </p>
                    <p className="text-sm text-gray-500">
                      {status === 'operational' ? 'All systems normal' : 
                       status === 'degraded' ? 'Performance issues' : 'Service unavailable'}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(status)}`}>
                  {status}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Run Backup
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Clear Cache
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                View Logs
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                System Check
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <Users className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-semibold mb-1">New Users Today</h3>
          <p className="text-2xl font-bold">12</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <Activity className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-semibold mb-1">Avg. Response Time</h3>
          <p className="text-2xl font-bold">128ms</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <Shield className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-semibold mb-1">Security Score</h3>
          <p className="text-2xl font-bold">98%</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;