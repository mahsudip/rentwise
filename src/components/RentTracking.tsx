import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Calendar, DollarSign, Eye, Edit, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import NepaliDate from 'nepali-date-converter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Nepali months in Bikram Sambat calendar
const NEPALI_MONTHS = [
  { value: "01", label: "बैशाख" },
  { value: "02", label: "जेठ" },
  { value: "03", label: "असार" },
  { value: "04", label: "साउन" },
  { value: "05", label: "भदौ" },
  { value: "06", label: "असोज" },
  { value: "07", label: "कार्तिक" },
  { value: "08", label: "मंसिर" },
  { value: "09", label: "पुष" },
  { value: "10", label: "माघ" },
  { value: "11", label: "फाल्गुन" },
  { value: "12", label: "चैत" }
];

interface Tenant {
  id: string;
  name: string;
  monthly_rent: number;
  rent_frequency: string;
  contract_start_date: string;
  contract_end_date: string;
  rent_increment_percentage: number;
  rent_increment_interval_years: number;
  properties?: { name: string };
}

interface RentPayment {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  paid: boolean;
  payment_date: string | null;
  payment_method?: string;
  cheque_number?: string;
  issue_bank?: string;
  deposit_bank?: string;
  notes?: string;
  tenants?: {
    name: string;
    properties?: { name: string };
  };
}

const RentTracking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<RentPayment[]>([]);
  const [tenants, setTenants] = useState<{id: string, name: string}[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [sortBy, setSortBy] = useState<{field: 'period_start' | 'payment_date', order: 'asc' | 'desc'}>({
    field: 'payment_date',
    order: 'desc'
  });
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<RentPayment | null>(null);

  const fetchTenants = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tenants",
        variant: "destructive"
      });
    }
  };

  const fetchRentPayments = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('rent_payments')
        .select(`
          *,
          tenants (
            id,
            name,
            properties (name)
          )
        `)
        .eq('user_id', user.id)
        .order('period_start', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setRentPayments(data || []);
      setFilteredPayments(data || []);
    } catch (error) {
      console.error('Error fetching rent payments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch rent payments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchTenants(), fetchRentPayments()]);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Filter and sort payments when selected tenant or sort changes
  useEffect(() => {
    let result = [...rentPayments];
    
    // Filter by tenant
    if (selectedTenant !== 'all') {
      result = result.filter(payment => payment.tenant_id === selectedTenant);
    }
    
    // Sort payments
    result.sort((a, b) => {
      // If sorting by payment_date and the payment is not paid, push it to the end
      if (sortBy.field === 'payment_date') {
        if (!a.paid) return 1;
        if (!b.paid) return -1;
        const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return sortBy.order === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Sort by period_start
      const dateA = new Date(a.period_start).getTime();
      const dateB = new Date(b.period_start).getTime();
      return sortBy.order === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    setFilteredPayments(result);
  }, [selectedTenant, rentPayments, sortBy]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rent_payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Rent payment deleted successfully" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete rent payment",
        variant: "destructive"
      });
    }
  };

  const togglePaymentStatus = async (payment: RentPayment) => {
    try {
      const { error } = await supabase
        .from('rent_payments')
        .update({
          paid: !payment.paid,
          payment_date: !payment.paid ? new Date().toISOString().split('T')[0] : null
        } as never) // Type assertion to handle Supabase's generic types
        .eq('id', payment.id);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive"
      });
    }
  };

  const openViewDialog = (payment: RentPayment) => {
    setViewingPayment(payment);
    setViewDialogOpen(true);
  };

  const handleEditPayment = (payment: RentPayment) => {
    navigate(`/edit-payment/${payment.id}`);
  };

  // Convert Gregorian year to Bikram Sambat year (approximate)
  const toBikramSambatYear = (gregorianYear: number): number => {
    // Bikram Sambat is approximately 56-57 years ahead of Gregorian
    return gregorianYear + 57;
  };

  // Convert AD date to BS date string using nepali-date-converter
  const toBSDateString = (adDate: string, includeDay: boolean = false): string => {
    try {
      // Handle both YYYY-MM-DD and full ISO date formats
      const dateStr = adDate.includes('T') ? adDate.split('T')[0] : adDate;
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const nepaliDate = new NepaliDate(date);
      return nepaliDate.format(includeDay ? 'YYYY MMMM DD' : 'YYYY MMMM', 'np');
    } catch (error) {
      console.error('Error converting to BS date:', error);
      return 'Invalid date';
    }
  };

  const formatDate = (dateString: string, includeDay: boolean = false) => {
    try {
      // Parse the date string in the format YYYY-MM-DD
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-GB', { 
        day: includeDay ? '2-digit' : undefined,
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getNepaliMonthYear = (dateString: string) => {
    try {
      // Parse the date string in the format YYYY-MM-DD
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) return { month: 'Invalid', year: 'date' };
      
      const monthIndex = date.getMonth();
      const monthLabel = NEPALI_MONTHS[monthIndex]?.label || 'Invalid';
      const yearLabel = toBikramSambatYear(date.getFullYear());
      
      return { month: monthLabel, year: yearLabel.toString() };
    } catch (error) {
      console.error('Error getting Nepali month/year:', error);
      return { month: 'Invalid', year: 'date' };
    }
  };

  if (loading) return <div className="text-center py-8">Loading rent payments...</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Rent Tracking</h2>
        <div className="grid grid-cols-1 sm:flex gap-4 w-full sm:w-auto">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <div className="col-span-1">
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-full flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      <SelectValue placeholder="Tenant" />
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1">
              <Select
                value={`${sortBy.field}-${sortBy.order}`}
                onValueChange={(value) => {
                  const [field, order] = value.split('-') as [
                    'payment_date' | 'period_start',
                    'asc' | 'desc'
                  ];
                  setSortBy({ field, order });
                }}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-muted-foreground flex-shrink-0"
                    >
                      <path d="m3 16 4 4 4-4"></path>
                      <path d="M7 20V4"></path>
                      <path d="m21 8-4-4-4 4"></path>
                      <path d="M17 4v16"></path>
                    </svg>
                    <span className="truncate">
                      <SelectValue>
                        {sortBy.field === 'period_start'
                          ? `Rent (${sortBy.order === 'desc' ? 'New' : 'Old'})`
                          : `Paid (${sortBy.order === 'desc' ? 'New' : 'Old'})`}
                      </SelectValue>
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_date-desc">Payment Date (Newest First)</SelectItem>
                  <SelectItem value="payment_date-asc">Payment Date (Oldest First)</SelectItem>
                  <SelectItem value="period_start-desc">Rent Period (Newest First)</SelectItem>
                  <SelectItem value="period_start-asc">Rent Period (Oldest First)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={() => navigate('/add-payment')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPayments.map((payment) => (
          <Card key={payment.id} className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{payment.tenants?.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openViewDialog(payment)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPayment(payment);
                    }}
                    title={`Edit Payment: ${payment.paid ? "Mark as Unpaid" : "Mark as Paid"}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(payment.id)}
                    title="Delete Payment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                {payment.paid ? (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    Paid
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                    Unpaid
                  </span>
                )}
                <span className="text-muted-foreground">{payment.tenants?.properties?.name}</span>
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-sm">
                    {(() => {
                      const start = getNepaliMonthYear(payment.period_start);
                      const end = getNepaliMonthYear(payment.period_end);
                      const startDate = new Date(payment.period_start);
                      const endDate = new Date(payment.period_end);
                      const monthsDifference = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                            (endDate.getMonth() - startDate.getMonth()) + 1;
                      
                      if (monthsDifference <= 1) {
                        return `${start.month} ${start.year}`;
                      }
                      return `${start.month} ${start.year} - ${end.month} ${end.year}`;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">रू</span>
                  <span>{payment.amount.toLocaleString()}</span>
                </div>
                {payment.payment_date && (() => {
                  // Format: YYYY-MM-DD
                  const [year, month, day] = payment.payment_date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  
                  return (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Paid on: {date.toLocaleDateString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        BS: {toBSDateString(payment.payment_date, true)}
                      </div>
                    </div>
                  );
                })()}
                {payment.notes && (
                  <div className="pt-2 text-sm">
                    <div className="font-medium">Notes:</div>
                    <div className="mt-1 p-2 bg-muted/30 rounded text-muted-foreground">
                      {payment.notes}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredPayments.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No payments found for the selected tenant.</p>
          </CardContent>
        </Card>
      )}

      {/* Payment Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Payment Details</DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Basic Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Tenant:</strong> {viewingPayment.tenants?.name}</div>
                    <div><strong>Property:</strong> {viewingPayment.tenants?.properties?.name}</div>
                    <div><strong>Amount:</strong> रू {viewingPayment.amount}</div>
                    <div><strong>Status:</strong> {viewingPayment.paid ? 'Paid' : 'Unpaid'}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Payment Period</h4>
                  <div className="space-y-1 text-sm">
                    <div className="space-y-1">
                      <div><strong>Period:</strong> {formatDate(viewingPayment.period_start)} - {formatDate(viewingPayment.period_end)}</div>
                      <div className="text-muted-foreground">
                        {(() => {
                          const start = getNepaliMonthYear(viewingPayment.period_start);
                          const end = getNepaliMonthYear(viewingPayment.period_end);
                          const startDate = new Date(viewingPayment.period_start);
                          const endDate = new Date(viewingPayment.period_end);
                          const monthsDifference = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                                (endDate.getMonth() - startDate.getMonth()) + 1;
                          
                          if (monthsDifference <= 1) {
                            return `${start.month} ${start.year}`;
                          }
                          return `${start.month} ${start.year} - ${end.month} ${end.year}`;
                        })()}
                      </div>
                    </div>
                    {viewingPayment.paid && viewingPayment.payment_date && (
                      <div className="space-y-1">
                        <div><strong>Payment Date:</strong> {formatDate(viewingPayment.payment_date, true)}</div>
                        <div className="text-muted-foreground">
                          {toBSDateString(viewingPayment.payment_date, true)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {viewingPayment.payment_method && (
                <div>
                  <h4 className="font-semibold">Payment Method Details</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Method:</strong> {viewingPayment.payment_method}</div>
                    {viewingPayment.cheque_number && (
                      <div><strong>Cheque Number:</strong> {viewingPayment.cheque_number}</div>
                    )}
                    {viewingPayment.issue_bank && (
                      <div><strong>Issue Bank:</strong> {viewingPayment.issue_bank}</div>
                    )}
                    {viewingPayment.deposit_bank && (
                      <div><strong>Deposit Bank:</strong> {viewingPayment.deposit_bank}</div>
                    )}
                  </div>
                </div>
              )}
              
              {viewingPayment.notes && (
                <div>
                  <h4 className="font-semibold">Notes</h4>
                  <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    {viewingPayment.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RentTracking;