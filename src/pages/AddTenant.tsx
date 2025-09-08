import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Property {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
  company_name: string | null;
  citizenship_number: string | null;
  monthly_rent: number;
  rent_frequency: string;
  contract_start_date: string;
  contract_period_years: number;
  contract_period_months: number;
  rent_increment_percentage: number | null;
  rent_increment_interval_years: number | null;
  property_id: string | null;
  // Add any other fields that might be in your tenants table
}

const RENT_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "bi-monthly", label: "Bi-Monthly" },
  { value: "tri-monthly", label: "Tri-Monthly" },
  { value: "semi-annually", label: "Semi-Annually" },
  { value: "yearly", label: "Yearly" }
];

const AddTenant = () => {
  const { id: tenantId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    citizenship_number: "",
    monthly_rent: "",
    rent_frequency: "monthly",
    contract_start_date: "",
    contract_period_years: "5",
    contract_period_months: "0",
    contract_end_date: "",
    rent_increment_percentage: "10",
    rent_increment_interval_years: "2",
    property_id: ""
  });

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

  const calculateContractEndDate = (startDate: string, years: number, months: number) => {
    if (!startDate || (!years && !months)) return null;
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    endDate.setMonth(endDate.getMonth() + months);
    endDate.setDate(endDate.getDate() - 1);
    return endDate.toISOString().split('T')[0];
  };

  const payableAmount = (() => {
    const monthly = parseFloat(formData.monthly_rent || '0');
    const months = getFrequencyMonths(formData.rent_frequency);
    const amount = monthly * months;
    if (!isFinite(amount) || isNaN(amount)) return 0;
    return amount;
  })();

  const fetchProperties = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .eq('user_id', user.id);

      if (error) throw error;

      const tenantId = isEditing ? tenantId : data?.[0]?.id;
      if (!tenantId) throw new Error(isEditing ? "Failed to update tenant" : "Failed to create tenant");

      setProperties(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch properties",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchProperties();
      
      if (tenantId) {
        await fetchTenant(tenantId);
      } else {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, tenantId]);
  
  const fetchTenant = async (id: string) => {
    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single<Tenant>();
        
      if (error) throw error;
      
      if (tenant) {
        setIsEditing(true);
        const endDate = calculateContractEndDate(
          tenant.contract_start_date,
          Number(tenant.contract_period_years),
          Number(tenant.contract_period_months)
        );
        
        setFormData({
          name: tenant.name,
          company_name: tenant.company_name || '',
          citizenship_number: tenant.citizenship_number || '',
          monthly_rent: tenant.monthly_rent.toString(),
          rent_frequency: tenant.rent_frequency,
          contract_start_date: tenant.contract_start_date,
          contract_period_years: tenant.contract_period_years.toString(),
          contract_period_months: tenant.contract_period_months.toString(),
          rent_increment_percentage: (tenant.rent_increment_percentage || 0).toString(),
          rent_increment_interval_years: (tenant.rent_increment_interval_years || 0).toString(),
          property_id: tenant.property_id || '',
          contract_end_date: endDate || ''
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tenant details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.name || !formData.monthly_rent || !formData.contract_start_date || !formData.property_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const tenantData = {
        name: formData.name,
        company_name: formData.company_name || null,
        citizenship_number: formData.citizenship_number || null,
        monthly_rent: parseFloat(formData.monthly_rent),
        rent_frequency: formData.rent_frequency,
        contract_start_date: formData.contract_start_date,
        contract_period_years: parseInt(formData.contract_period_years),
        contract_period_months: parseInt(formData.contract_period_months),
        contract_end_date: formData.contract_end_date || null,
        rent_increment_percentage: formData.rent_increment_percentage ? parseFloat(formData.rent_increment_percentage) : 0,
        rent_increment_interval_years: formData.rent_increment_interval_years ? parseInt(formData.rent_increment_interval_years) : 0,
        property_id: formData.property_id || null,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as const;

      let data, error;
      
      if (isEditing && tenantId) {
        // Update existing tenant
        const { data: updateData, error: updateError } = await supabase
          .from('tenants')
          .update(tenantData)
          .eq('id', tenantId)
          .select();
        data = updateData;
        error = updateError;
      } else {
        // Create new tenant
        const { data: insertData, error: insertError } = await supabase
          .from('tenants')
          .insert([tenantData])
          .select();
        data = insertData;
        error = insertError;
      }

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: isEditing ? "Tenant updated successfully" : "Tenant added successfully" 
      });
      navigate("/?tab=tenants");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tenant",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/?tab=tenants")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">{isEditing ? 'Edit' : 'Add'} Tenant</h1>
        <p className="text-muted-foreground mt-2">
          {isEditing ? 'Update tenant information' : 'Add a new tenant to your property'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Information</CardTitle>
          <CardDescription>
            Fill in the details for the new tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Tenant Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter tenant name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter company name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="citizenship_number">Citizenship Number</Label>
              <Input
                id="citizenship_number"
                value={formData.citizenship_number}
                onChange={(e) => setFormData({ ...formData, citizenship_number: e.target.value })}
                placeholder="Enter citizenship number"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="property_id">Property *</Label>
              <Select value={formData.property_id} onValueChange={(value) => setFormData({ ...formData, property_id: value })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="monthly_rent">Monthly Rent *</Label>
              <Input
                id="monthly_rent"
                type="number"
                value={formData.monthly_rent}
                onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                placeholder="Enter monthly rent"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="rent_frequency">Rent Frequency *</Label>
              <Select value={formData.rent_frequency} onValueChange={(value) => setFormData({ ...formData, rent_frequency: value })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENT_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1">
                Payable: ${payableAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <Label htmlFor="contract_start_date">Contract Start Date *</Label>
              <div className="relative mt-2">
                <Input
                  id="contract_start_date"
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                  className="pr-10"
                />
                <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-base font-medium">Contract Period</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Label htmlFor="contract_period_years" className="text-sm text-muted-foreground">Years</Label>
                <Input
                  id="contract_period_years"
                  type="number"
                  value={formData.contract_period_years}
                  onChange={(e) => setFormData({ ...formData, contract_period_years: e.target.value })}
                  placeholder="1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contract_period_months" className="text-sm text-muted-foreground">Months</Label>
                <Input
                  id="contract_period_months"
                  type="number"
                  value={formData.contract_period_months}
                  onChange={(e) => setFormData({ ...formData, contract_period_months: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
            <div className="text-blue-700 dark:text-blue-300 font-medium">
              Contract End Date: {calculateContractEndDate(
                formData.contract_start_date,
                parseInt(formData.contract_period_years) || 0,
                parseInt(formData.contract_period_months) || 0
              ) || 'Not calculated'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="rent_increment_percentage">Rent Increment %</Label>
              <Input
                id="rent_increment_percentage"
                type="number"
                step="0.1"
                value={formData.rent_increment_percentage}
                onChange={(e) => setFormData({ ...formData, rent_increment_percentage: e.target.value })}
                placeholder="Increment percentage"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="rent_increment_interval_years">Increment Interval (Years)</Label>
              <Input
                id="rent_increment_interval_years"
                type="number"
                value={formData.rent_increment_interval_years}
                onChange={(e) => setFormData({ ...formData, rent_increment_interval_years: e.target.value })}
                placeholder="Interval in years"
                className="mt-2"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <Label className="text-base font-medium">Documents</Label>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> You can upload documents after saving the tenant from the tenant details page.
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-end pt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/?tab=tenants")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={saving || loading}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : loading ? "Loading..." : isEditing ? "Update Tenant" : "Add Tenant"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddTenant;
