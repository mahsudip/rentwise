import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarIcon, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import NepaliDate from 'nepali-date-converter';

interface Tenant {
  id: string;
  name: string;
  monthly_rent: number;
  rent_frequency: string;
  properties?: { name: string };
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_deposit", label: "Bank Deposit" }
];

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

// Convert Gregorian year to Bikram Sambat year (approximate)
const toBikramSambatYear = (gregorianYear: number): number => {
  // Bikram Sambat is approximately 56-57 years ahead of Gregorian
  return gregorianYear + 57;
};

// Convert AD date to BS date string using nepali-date-converter
const toBSDateString = (adDate: string): string => {
  try {
    const date = new Date(adDate);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    // Convert to Nepali date
    const nepaliDate = new NepaliDate(date);
    
    // Format: BS Year Month Day in Nepali (e.g., २०८० बैशाख १५)
    return nepaliDate.format('YYYY MMMM DD', 'np');
  } catch (error) {
    console.error('Error converting date:', error);
    return 'Invalid date';
  }
};

const AddPayment = () => {
  const { id: paymentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: "",
    period_month_year: "",
    payment_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
    amount: "",
    payment_method: "cash",
    cheque_number: "",
    issue_bank: "",
    deposit_bank: "",
    notes: ""
  });
  
  const [bsDate, setBsDate] = useState(toBSDateString(new Date().toISOString().split('T')[0]));

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

  const getFrequencyLabel = (frequency: string) => {
    const map: { [key: string]: string } = {
      'monthly': 'Monthly',
      'bi-monthly': 'Bi-Monthly (Every 2 months)',
      'tri-monthly': 'Tri-Monthly (Every 3 months)',
      'semi-annually': 'Semi-Annually (Every 6 months)',
      'yearly': 'Yearly'
    };
    return map[frequency] || 'Monthly';
  };

  const selectedTenant = tenants.find(t => t.id === formData.tenant_id);
  const autoCalculatedAmount = selectedTenant ? 
    selectedTenant.monthly_rent * getFrequencyMonths(selectedTenant.rent_frequency) : 0;

  const calculatePeriodEnd = (monthYear: string) => {
    if (!monthYear) return null;
    
    const [year, month] = monthYear.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const frequencyMonths = selectedTenant ? getFrequencyMonths(selectedTenant.rent_frequency) : 1;
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + frequencyMonths);
    endDate.setDate(endDate.getDate() - 1);
    
    return endDate.toISOString().split('T')[0];
  };

  const fetchTenants = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          monthly_rent,
          rent_frequency,
          properties (name)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tenants",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchTenants();
      
      if (paymentId) {
        await fetchPayment(paymentId);
      } else {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, paymentId]);
  
  const fetchPayment = async (id: string) => {
    try {
      const { data: payment, error } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      if (payment) {
        setIsEditing(true);
        setFormData({
          tenant_id: payment.tenant_id,
          period_month_year: payment.period_start.slice(0, 7), // YYYY-MM format
          payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
          amount: payment.amount.toString(),
          payment_method: payment.payment_method || 'cash',
          cheque_number: payment.cheque_number || '',
          issue_bank: payment.issue_bank || '',
          deposit_bank: payment.deposit_bank || '',
          notes: payment.notes || ''
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      setFormData(prev => ({
        ...prev,
        amount: autoCalculatedAmount.toString()
      }));
    }
  }, [selectedTenant, autoCalculatedAmount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    
    setFormData(newFormData);
    
    // Update BS date when payment_date changes
    if (name === 'payment_date') {
      setBsDate(toBSDateString(value));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.tenant_id || !formData.period_month_year || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const periodStart = `${formData.period_month_year}-01`;
      const periodEnd = calculatePeriodEnd(formData.period_month_year);

      if (!periodEnd) {
        throw new Error("Invalid period dates");
      }

      const paymentData = {
        user_id: user.id,
        tenant_id: formData.tenant_id,
        period_start: periodStart,
        period_end: periodEnd,
        amount: parseFloat(formData.amount),
        paid: true,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        cheque_number: formData.payment_method === 'cheque' ? formData.cheque_number : null,
        issue_bank: formData.payment_method === 'cheque' ? formData.issue_bank : null,
        deposit_bank: ['cheque', 'bank_deposit'].includes(formData.payment_method) ? formData.deposit_bank : null,
        notes: formData.notes || null
      };

      let error;
      if (isEditing && paymentId) {
        // Update existing payment
        const { error: updateError } = await supabase
          .from('rent_payments')
          .update(paymentData)
          .eq('id', paymentId);
        error = updateError;
      } else {
        // Create new payment
        const { error: insertError } = await supabase
          .from('rent_payments')
          .insert([paymentData]);
        error = insertError;
      }
      
      if (error) throw error;
      
      toast({ 
        title: "Success", 
        description: isEditing ? "Payment updated successfully" : "Payment added successfully" 
      });
      navigate("/?tab=rent-tracking");
    } catch (error) {
      toast({
        title: "Error",
        description: isEditing ? "Failed to update payment" : "Failed to add payment",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate month-year options for the next 2 years in Nepali calendar
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const monthYearOptions = [];
  for (let i = 0; i < 24; i++) {
    const date = new Date(currentYear, currentMonth + i, 1);
    const nepaliYear = toBikramSambatYear(date.getFullYear());
    const monthIndex = date.getMonth(); // 0-11
    const monthValue = (monthIndex + 1).toString().padStart(2, '0');
    const monthLabel = NEPALI_MONTHS[monthIndex].label;
    
    monthYearOptions.push({
      value: `${date.getFullYear()}-${monthValue}`,
      label: `${monthLabel} ${nepaliYear} (${date.getFullYear()})`,
      nepaliMonth: monthLabel,
      nepaliYear: nepaliYear
    });
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/?tab=rent-tracking")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">{isEditing ? 'Edit' : 'Add'} Payment</h1>
        <p className="text-muted-foreground mt-2">
          {isEditing ? 'Update the payment details' : 'Record a new rent payment for a tenant'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>
            Fill in the payment details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="tenant_id">Tenant *</Label>
            <Select 
              value={formData.tenant_id} 
              onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}
              disabled={isEditing}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={isEditing ? "" : "Select tenant"} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name} - {tenant.properties?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTenant && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Info className="h-4 w-4" />
                  <span>
                    {getFrequencyLabel(selectedTenant.rent_frequency)} - ${selectedTenant.monthly_rent} per month
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="period_month_year">Month and Year *</Label>
            <Select 
              value={formData.period_month_year} 
              onValueChange={(value) => setFormData({ ...formData, period_month_year: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="महिना र वर्ष चयन गर्नुहोस्">
                  {formData.period_month_year ? (() => {
                    const selected = monthYearOptions.find(opt => opt.value === formData.period_month_year);
                    return selected ? `${selected.nepaliMonth} ${selected.nepaliYear}` : 'महिना र वर्ष चयन गर्नुहोस्';
                  })() : 'महिना र वर्ष चयन गर्नुहोस्'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthYearOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.period_month_year && selectedTenant && (() => {
            const startDate = new Date(formData.period_month_year);
            const startMonthIndex = startDate.getMonth();
            const startMonth = NEPALI_MONTHS[startMonthIndex].label;
            const startYear = toBikramSambatYear(startDate.getFullYear());
            
            const endDate = calculatePeriodEnd(formData.period_month_year);
            let periodDisplay = `${startMonth} ${startYear}`;
            
            if (endDate) {
              const endDateObj = new Date(endDate);
              const endMonthIndex = endDateObj.getMonth();
              const endMonth = NEPALI_MONTHS[endMonthIndex].label;
              const endYear = toBikramSambatYear(endDateObj.getFullYear());
              
              // Calculate months difference
              const monthsDifference = (endDateObj.getFullYear() - startDate.getFullYear()) * 12 + 
                                    (endDateObj.getMonth() - startDate.getMonth()) + 1;
              
              if (monthsDifference > 1) {
                periodDisplay += ` - ${endMonth} ${endYear}`;
              }
            }
            
            return (
              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg text-center">
                <div className="text-green-700 dark:text-green-300 font-medium">
                  {periodDisplay}
                </div>
              </div>
            );
          })()}

          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter amount"
              className="mt-2"
            />
            {selectedTenant && (
              <div className="text-xs text-muted-foreground mt-1">
                Auto-calculated: ${autoCalculatedAmount.toLocaleString()} (you can adjust this amount)
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="payment_method">Payment Method *</Label>
            <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="payment_date">Payment Date (AD)</Label>
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={handleInputChange}
                required
                className="mb-2"
              />
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">BS:</span> {bsDate}
              </div>
            </div>
          </div>

          {formData.payment_method === 'cheque' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="cheque_number">Cheque Number</Label>
                <Input
                  id="cheque_number"
                  value={formData.cheque_number}
                  onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                  placeholder="Enter cheque number"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="issue_bank">Issue Bank</Label>
                <Input
                  id="issue_bank"
                  value={formData.issue_bank}
                  onChange={(e) => setFormData({ ...formData, issue_bank: e.target.value })}
                  placeholder="Enter issue bank"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          {['cheque', 'bank_deposit'].includes(formData.payment_method) && (
            <div>
              <Label htmlFor="deposit_bank">Deposit Bank</Label>
              <Input
                id="deposit_bank"
                value={formData.deposit_bank}
                onChange={(e) => setFormData({ ...formData, deposit_bank: e.target.value })}
                placeholder="Enter deposit bank"
                className="mt-2"
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="flex gap-4 justify-end pt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/?tab=rent-tracking")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : loading ? "Loading..." : isEditing ? "Update Payment" : "Save Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddPayment;
