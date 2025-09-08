import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, DollarSign, Home, Users, Clock, TrendingUp } from "lucide-react";
import { format, differenceInDays, addMonths, addYears } from "date-fns";

interface DashboardStats {
  totalProperties: number;
  totalTenants: number;
  monthlyRevenue: number;
  recentPayments: any[];
  upcomingRenewals: any[];
  overduePayments: any[];
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalTenants: 0,
    monthlyRevenue: 0,
    recentPayments: [],
    upcomingRenewals: [],
    overduePayments: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch properties count
      const { count: propertiesCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch tenants count and data
      const { data: tenants, count: tenantsCount } = await supabase
        .from('tenants')
        .select('*, properties(name)', { count: 'exact' })
        .eq('user_id', user.id);

      // Fetch recent payments
      const { data: payments } = await supabase
        .from('rent_payments')
        .select('*, tenants(name, properties(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Calculate monthly revenue
      const monthlyRevenue = tenants?.reduce((sum, tenant) => {
        const frequencyMonths = getFrequencyMonths(tenant.rent_frequency);
        return sum + (tenant.monthly_rent * frequencyMonths);
      }, 0) || 0;

      // Calculate upcoming renewals (show all future renewals)
      const upcomingRenewals = tenants?.map(tenant => {
        // Calculate contract end date properly (start + period - 1 day)
        const startDate = new Date(tenant.contract_start_date);
        const totalMonths = (tenant.contract_period_years * 12) + tenant.contract_period_months;
        const contractEnd = new Date(startDate);
        contractEnd.setMonth(contractEnd.getMonth() + totalMonths);
        contractEnd.setDate(contractEnd.getDate() - 1); // Subtract 1 day for actual end date
        
        const daysLeft = differenceInDays(contractEnd, new Date());
        return {
          ...tenant,
          daysLeft,
          contractEndDate: contractEnd
        };
      }).filter(tenant => tenant.daysLeft > 0)
       .sort((a, b) => a.daysLeft - b.daysLeft) || [];

      // Find overdue payments (simplified logic)
      const overduePayments = payments?.filter(payment => 
        !payment.paid && new Date(payment.period_end) < new Date()
      ) || [];

      setStats({
        totalProperties: propertiesCount || 0,
        totalTenants: tenantsCount || 0,
        monthlyRevenue,
        recentPayments: payments || [],
        upcomingRenewals,
        overduePayments
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyMonths = (frequency: string) => {
    const map: { [key: string]: number } = {
      'monthly': 1,
      'bi-monthly': 2,
      'tri-monthly': 3,
      'semi-annually': 6,
      'yearly': 12
    };
    return map[frequency] || 1;
  };

  const getDaysLeftBadge = (daysLeft: number) => {
    if (daysLeft <= 30) return "destructive";
    if (daysLeft <= 60) return "secondary";
    return "default";
  };

  const formatDaysLeft = (days: number) => {
    if (days <= 0) return "Expired";
    
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    const finalDays = remainingDays % 30;
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (finalDays > 0) parts.push(`${finalDays} day${finalDays > 1 ? 's' : ''}`);
    
    return parts.join(', ');
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your rental business.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProperties}</div>
            <p className="text-xs text-muted-foreground">Total properties managed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
            <p className="text-xs text-muted-foreground">Active tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NPR {stats.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Potential monthly income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overduePayments.length}</div>
            <p className="text-xs text-muted-foreground">Overdue payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {stats.recentPayments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payments recorded yet</p>
            ) : (
              stats.recentPayments.map((payment) => (
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                  <div>
                    <p className="font-medium">{payment.tenants?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.tenants?.properties?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.period_start), 'MMM dd')} - {format(new Date(payment.period_end), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between sm:justify-end items-center sm:items-end gap-2">
                    <p className="font-semibold">NPR {payment.amount.toLocaleString()}</p>
                    <Badge variant={payment.paid ? "default" : "secondary"}>
                      {payment.paid ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Renewals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming Renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {stats.upcomingRenewals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming renewals</p>
            ) : (
              stats.upcomingRenewals.map((tenant) => (
                <div key={tenant.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                  <div>
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.properties?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contract ends: {format(tenant.contractEndDate, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <Badge variant={getDaysLeftBadge(tenant.daysLeft)}>
                      {formatDaysLeft(tenant.daysLeft)} left
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;