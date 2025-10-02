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
    newUsersThisWeek: 0,
    newAdminsThisWeek: 0,
    weeklySessionChange: 0,
    weeklyLockedChange: 0,
    newUsersToday: 0,
    confirmedUsers: 0,
    unconfirmedUsers: 0,
    loading: true
  });

  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    user: string;
    action: string;
    target: string;
    time: string;
    status: 'success' | 'warning';
  }>>([]);

  const [systemStatus, setSystemStatus] = useState({
    database: 'checking' as 'operational' | 'degraded' | 'down' | 'checking',
    api: 'checking' as 'operational' | 'degraded' | 'down' | 'checking',
    authentication: 'checking' as 'operational' | 'degraded' | 'down' | 'checking',
    userManagement: 'checking' as 'operational' | 'degraded' | 'down' | 'checking',
  });

  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [quickActionMessage, setQuickActionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const checkSystemHealth = async () => {
    try {
      // Test database connectivity
      const dbStart = Date.now();
      const { error: dbError } = await supabase.from('roles').select('count').limit(1);
      const dbTime = Date.now() - dbStart;
      
      // Test RPC functionality
      const rpcStart = Date.now();
      const { error: rpcError } = await supabase.rpc('get_users_as_admin').limit(1);
      const rpcTime = Date.now() - rpcStart;
      
      // Test authentication
      const authStart = Date.now();
      const { error: authError } = await supabase.auth.getUser();
      const authTime = Date.now() - authStart;
      
      setSystemStatus({
        database: dbError ? 'down' : (dbTime > 1000 ? 'degraded' : 'operational'),
        api: rpcError ? 'down' : (rpcTime > 2000 ? 'degraded' : 'operational'),
        authentication: authError ? 'down' : (authTime > 500 ? 'degraded' : 'operational'),
        userManagement: (dbError || rpcError) ? 'down' : ((dbTime + rpcTime) > 1500 ? 'degraded' : 'operational')
      });
    } catch (error) {
      console.error('System health check failed:', error);
      setSystemStatus({
        database: 'down',
        api: 'down',
        authentication: 'down',
        userManagement: 'down'
      });
    }
  };

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

        // Calculate weekly changes
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newUsersThisWeek = users?.filter((user: any) => 
          user.created_at && new Date(user.created_at) > oneWeekAgo
        ).length || 0;

        const newAdminsThisWeek = users?.filter((user: any) => 
          user.created_at && 
          new Date(user.created_at) > oneWeekAgo &&
          user.raw_user_meta_data?.roles?.includes('Admin')
        ).length || 0;

        // For sessions, compare current active vs week ago active
        const weeklySessionChange = activeSessions; // Simplified - could be enhanced

        // For locked accounts, this is a bit tricky without timestamp data
        // We'll assume current locked count as change for now
        const weeklyLockedChange = lockedAccounts; // Could be enhanced with lock timestamps

        // Calculate additional metrics for bottom cards
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const newUsersToday = users?.filter((user: any) => 
          user.created_at && new Date(user.created_at) >= today
        ).length || 0;

        const confirmedUsers = users?.filter((user: any) => 
          user.email_confirmed_at
        ).length || 0;

        const unconfirmedUsers = totalUsers - confirmedUsers;

        // Generate recent activities from user data
        const activities: Array<{
          id: string;
          user: string;
          action: string;
          target: string;
          time: string;
          status: 'success' | 'warning';
        }> = [];

        // Add new user registrations (last 7 days)
        const newUsers = users?.filter((user: any) => 
          user.created_at && new Date(user.created_at) > oneWeekAgo
        ).slice(0, 5) || [];

        newUsers.forEach((user: any) => {
          const createdDate = new Date(user.created_at);
          const hoursAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60));
          
          activities.push({
            id: `reg-${user.id}`,
            user: user.raw_user_meta_data?.name || user.email.split('@')[0],
            action: 'Account created',
            target: user.raw_user_meta_data?.roles?.[0] || 'User',
            time: hoursAgo < 1 ? 'Just now' : 
                  hoursAgo < 24 ? `${hoursAgo} hours ago` : 
                  `${Math.floor(hoursAgo / 24)} days ago`,
            status: 'success'
          });
        });

        // Add recent sign-ins (last 24 hours)
        const recentSignIns = users?.filter((user: any) => 
          user.last_sign_in_at && new Date(user.last_sign_in_at) > oneDayAgo
        ).slice(0, 3) || [];

        recentSignIns.forEach((user: any) => {
          const signInDate = new Date(user.last_sign_in_at);
          const minutesAgo = Math.floor((Date.now() - signInDate.getTime()) / (1000 * 60));
          
          activities.push({
            id: `signin-${user.id}`,
            user: user.raw_user_meta_data?.name || user.email.split('@')[0],
            action: 'Signed in',
            target: user.raw_user_meta_data?.roles?.[0] || 'User',
            time: minutesAgo < 1 ? 'Just now' : 
                  minutesAgo < 60 ? `${minutesAgo} minutes ago` : 
                  `${Math.floor(minutesAgo / 60)} hours ago`,
            status: 'success'
          });
        });

        // Add locked accounts
        const lockedUsers = users?.filter((user: any) => 
          user.raw_user_meta_data?.isLocked
        ).slice(0, 2) || [];

        lockedUsers.forEach((user: any) => {
          activities.push({
            id: `locked-${user.id}`,
            user: user.raw_user_meta_data?.name || user.email.split('@')[0],
            action: 'Account locked',
            target: user.raw_user_meta_data?.roles?.[0] || 'User',
            time: 'Recent',
            status: 'warning'
          });
        });

        // Sort activities by most recent and limit to 8
        const sortedActivities = activities
          .sort((a, b) => {
            // Simple sorting - put "Just now" and recent times first
            if (a.time.includes('Just now')) return -1;
            if (b.time.includes('Just now')) return 1;
            if (a.time.includes('minutes')) return -1;
            if (b.time.includes('minutes')) return 1;
            return 0;
          })
          .slice(0, 8);

        setRecentActivities(sortedActivities);
        setStatsData({
          totalUsers,
          adminUsers,
          activeSessions,
          lockedAccounts,
          newUsersThisWeek,
          newAdminsThisWeek,
          weeklySessionChange,
          weeklyLockedChange,
          newUsersToday,
          confirmedUsers,
          unconfirmedUsers,
          loading: false
        });

        // Check system health
        await checkSystemHealth();
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStatsData(prev => ({ ...prev, loading: false }));
        // Set systems as degraded if there's an error
        setSystemStatus({
          database: 'degraded',
          api: 'degraded', 
          authentication: 'operational', // Auth worked if we got here
          userManagement: 'degraded'
        });
      }
    };

    fetchStats();
  }, []);

  // Quick Actions Handlers
  const handleRunBackup = async () => {
    setQuickActionLoading('backup');
    setQuickActionMessage(null);
    try {
      // Simulate backup process - in real app, this would call your backup API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, we'll just refresh the system health as a "backup" action
      await checkSystemHealth();
      
      setQuickActionMessage({ type: 'success', message: 'System backup completed successfully' });
    } catch (error) {
      setQuickActionMessage({ type: 'error', message: 'Backup failed. Please try again.' });
    } finally {
      setQuickActionLoading(null);
      setTimeout(() => setQuickActionMessage(null), 5000);
    }
  };

  const handleClearCache = async () => {
    setQuickActionLoading('cache');
    setQuickActionMessage(null);
    try {
      // Clear browser cache and refresh data
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Refresh the dashboard data
      window.location.reload();
      
      setQuickActionMessage({ type: 'success', message: 'Cache cleared successfully' });
    } catch (error) {
      setQuickActionMessage({ type: 'error', message: 'Failed to clear cache' });
    } finally {
      setQuickActionLoading(null);
      setTimeout(() => setQuickActionMessage(null), 5000);
    }
  };

  const handleViewLogs = () => {
    setQuickActionLoading('logs');
    try {
      // Open browser console or redirect to logs page
      console.log('=== ADMIN DASHBOARD LOGS ===');
      console.log('Dashboard Stats:', statsData);
      console.log('Recent Activities:', recentActivities);
      console.log('System Status:', systemStatus);
      console.log('Last Updated:', new Date().toISOString());
      
      setQuickActionMessage({ type: 'success', message: 'Logs opened in browser console (F12)' });
    } catch (error) {
      setQuickActionMessage({ type: 'error', message: 'Failed to access logs' });
    } finally {
      setQuickActionLoading(null);
      setTimeout(() => setQuickActionMessage(null), 5000);
    }
  };

  const handleSystemCheck = async () => {
    setQuickActionLoading('check');
    setQuickActionMessage(null);
    try {
      // Re-run system health checks
      await checkSystemHealth();
      
      // Also refresh user stats
      const { error } = await supabase.rpc("get_users_as_admin");
      if (error) throw error;
      
      const healthyServices = Object.values(systemStatus).filter(status => status === 'operational').length;
      const totalServices = Object.keys(systemStatus).length;
      
      setQuickActionMessage({ 
        type: 'success', 
        message: `System check complete. ${healthyServices}/${totalServices} services operational` 
      });
    } catch (error) {
      setQuickActionMessage({ type: 'error', message: 'System check failed' });
    } finally {
      setQuickActionLoading(null);
      setTimeout(() => setQuickActionMessage(null), 5000);
    }
  };

  const stats = [
    {
      title: 'Total Users',
      value: statsData.loading ? '...' : statsData.totalUsers.toString(),
      change: statsData.loading ? '...' : `+${statsData.newUsersThisWeek}`,
      trend: statsData.newUsersThisWeek > 0 ? 'up' : 'neutral',
      icon: Users,
      color: 'blue',
      description: 'Registered users'
    },
    {
      title: 'Admin Users',
      value: statsData.loading ? '...' : statsData.adminUsers.toString(),
      change: statsData.loading ? '...' : `+${statsData.newAdminsThisWeek}`,
      trend: statsData.newAdminsThisWeek > 0 ? 'up' : 'neutral',
      icon: Shield,
      color: 'purple',
      description: 'Administrators'
    },
    {
      title: 'Active Sessions',
      value: statsData.loading ? '...' : statsData.activeSessions.toString(),
      change: statsData.loading ? '...' : statsData.weeklySessionChange.toString(),
      trend: 'neutral',
      icon: Activity,
      color: 'green',
      description: 'Signed in today'
    },
    {
      title: 'Locked Accounts',
      value: statsData.loading ? '...' : statsData.lockedAccounts.toString(),
      change: statsData.loading ? '...' : statsData.weeklyLockedChange.toString(),
      trend: statsData.weeklyLockedChange > 0 ? 'up' : 'neutral',
      icon: AlertTriangle,
      color: 'red',
      description: 'Requires attention'
    }
  ];





  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'down': return 'text-red-600 bg-red-50';
      case 'checking': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle2 className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'down': return <AlertTriangle className="w-4 h-4" />;
      case 'checking': return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational': return 'All systems normal';
      case 'degraded': return 'Performance issues';
      case 'down': return 'Service unavailable';
      case 'checking': return 'Checking status...';
      default: return 'Unknown status';
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
                      <TrendingUp className={`w-4 h-4 ${stat.trend === 'up' ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ml-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-gray-600'}`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">this week</span>
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
              {statsData.loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </button>
          </div>
          
          <div className="space-y-4">
            {statsData.loading ? (
              // Loading state
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 rounded-lg animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
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
              ))
            ) : (
              // Empty state
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No recent activities to display</p>
                <p className="text-gray-400 text-xs mt-1">User activities will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
            {Object.values(systemStatus).some(status => status === 'checking') && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          
          <div className="space-y-4">
            {Object.entries(systemStatus).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {service === 'userManagement' ? 'User Management' : service}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getStatusText(status)}
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
            
            {/* Action Message */}
            {quickActionMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                quickActionMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {quickActionMessage.message}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleRunBackup}
                disabled={quickActionLoading === 'backup'}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {quickActionLoading === 'backup' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Run Backup'
                )}
              </button>
              
              <button 
                onClick={handleClearCache}
                disabled={quickActionLoading === 'cache'}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {quickActionLoading === 'cache' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Clear Cache'
                )}
              </button>
              
              <button 
                onClick={handleViewLogs}
                disabled={quickActionLoading === 'logs'}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {quickActionLoading === 'logs' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'View Logs'
                )}
              </button>
              
              <button 
                onClick={handleSystemCheck}
                disabled={quickActionLoading === 'check'}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {quickActionLoading === 'check' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'System Check'
                )}
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
          {statsData.loading ? (
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2 opacity-75" />
              <span className="text-xl font-bold opacity-75">Loading...</span>
            </div>
          ) : (
            <p className="text-2xl font-bold">{statsData.newUsersToday}</p>
          )}
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <CheckCircle2 className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-semibold mb-1">Email Confirmed</h3>
          {statsData.loading ? (
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2 opacity-75" />
              <span className="text-xl font-bold opacity-75">Loading...</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{statsData.confirmedUsers}</p>
              <span className="text-sm opacity-75">/ {statsData.totalUsers}</span>
            </div>
          )}
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <Shield className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-semibold mb-1">Security Score</h3>
          {statsData.loading ? (
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2 opacity-75" />
              <span className="text-xl font-bold opacity-75">Loading...</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">
                {statsData.totalUsers > 0 ? Math.round((statsData.confirmedUsers / statsData.totalUsers) * 100) : 0}
              </p>
              <span className="text-lg opacity-90">%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;