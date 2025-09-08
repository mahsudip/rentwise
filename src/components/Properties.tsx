import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Property {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

const Properties = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: ""
  });

  const fetchProperties = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch properties",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;

    try {
      if (editingProperty) {
        const { error } = await supabase
          .from('properties')
          .update(formData)
          .eq('id', editingProperty.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Property updated successfully" });
      } else {
        const { error } = await supabase
          .from('properties')
          .insert([{ ...formData, user_id: user.id }]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Property created successfully" });
      }
      
      setDialogOpen(false);
      resetForm();
      fetchProperties();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save property",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Property deleted successfully" });
      fetchProperties();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete property",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: "", address: "" });
    setEditingProperty(null);
  };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property);
    setFormData({
      name: property.name,
      address: property.address
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) return <div>Loading properties...</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-2xl font-bold">Properties</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4">
            <DialogHeader>
              <DialogTitle>
                {editingProperty ? "Edit Property" : "Add New Property"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter property name"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter property address"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingProperty ? "Update" : "Create"} Property
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <Card key={property.id} className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{property.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEditDialog(property)}
                    title="Edit Property"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(property.id)}
                    title="Delete Property"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{property.address}</CardDescription>
              <p className="text-xs text-muted-foreground mt-2">
                Created: {new Date(property.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {properties.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No properties found. Add your first property to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Properties;