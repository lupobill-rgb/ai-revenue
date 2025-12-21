import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield, Users, Building2, Plus, Search, Eye, Activity, Gauge } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';

interface PlatformAdmin {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  granted_at: string;
  notes: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  billing_plan: string;
  created_at: string;
}

export default function PlatformAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTenant, setSearchTenant] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkPlatformAdmin();
  }, [user]);

  const checkPlatformAdmin = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('is_platform_admin');
    
    if (error) {
      console.error('Error checking platform admin:', error);
      setIsPlatformAdmin(false);
    } else {
      setIsPlatformAdmin(data);
      if (data) {
        fetchData();
      }
    }
    setLoading(false);
  };

  const fetchData = async () => {
    const [adminsRes, tenantsRes] = await Promise.all([
      supabase.from('platform_admins').select('*').order('granted_at', { ascending: false }),
      supabase.from('tenants').select('*').order('name')
    ]);

    if (adminsRes.data) setAdmins(adminsRes.data);
    if (tenantsRes.data) setTenants(tenantsRes.data);
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) {
      toast.error('Email is required');
      return;
    }

    setAddingAdmin(true);

    // First check if user exists
    const { data: userData, error: userError } = await supabase
      .from('platform_admins')
      .select('email')
      .limit(1);

    // Look up user by email in auth.users via RPC or direct query
    const { data: existingUser } = await supabase
      .rpc('get_user_by_email', { _email: newAdminEmail })
      .maybeSingle();

    if (!existingUser) {
      toast.error('User not found. They must sign up first.');
      setAddingAdmin(false);
      return;
    }

    const { error } = await supabase.from('platform_admins').insert({
      user_id: existingUser.id,
      email: newAdminEmail,
      name: newAdminName || null,
      granted_by: user?.id
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('This user is already a platform admin');
      } else {
        toast.error('Failed to add admin: ' + error.message);
      }
    } else {
      toast.success('Platform admin added successfully');
      setNewAdminEmail('');
      setNewAdminName('');
      setDialogOpen(false);
      fetchData();
    }
    setAddingAdmin(false);
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('platform_admins')
      .update({ is_active: !currentStatus })
      .eq('id', adminId);

    if (error) {
      toast.error('Failed to update admin status');
    } else {
      toast.success(`Admin ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchData();
    }
  };

  const impersonateTenant = (tenantId: string, tenantName: string) => {
    localStorage.setItem('impersonated_tenant_id', tenantId);
    localStorage.setItem('impersonated_tenant_name', tenantName);
    toast.success(`Now viewing as ${tenantName}`);
    navigate('/dashboard');
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTenant.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have platform admin privileges.</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Platform Administration</h1>
          <p className="text-muted-foreground">Manage UbiGrowth platform admins and access all tenants</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to="/platform-admin/qa/tenant-isolation">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Tenant Isolation QA</p>
                  <p className="text-sm text-muted-foreground">Test data isolation</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/platform-admin/qa/execution-cert">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Execution Cert QA</p>
                  <p className="text-sm text-muted-foreground">Validate kernel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/platform-admin/slo">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">SLO Dashboard</p>
                  <p className="text-sm text-muted-foreground">Monitor SLOs & alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/platform-admin/rate-limits">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Gauge className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Rate Limits</p>
                  <p className="text-sm text-muted-foreground">Cost & rate controls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Platform Admins Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Platform Admins
            </CardTitle>
            <CardDescription>UbiGrowth team members with cross-tenant access</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Platform Admin</DialogTitle>
                <DialogDescription>
                  Add a UbiGrowth team member as a platform admin. They must have an existing account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="name@ubigrowth.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input 
                    id="name" 
                    placeholder="Full name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddAdmin} disabled={addingAdmin} className="w-full">
                  {addingAdmin ? 'Adding...' : 'Add Admin'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name || '-'}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                      {admin.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.granted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={admin.is_active}
                      onCheckedChange={() => toggleAdminStatus(admin.id, admin.is_active)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tenants Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Tenants
              </CardTitle>
              <CardDescription>View and access any tenant account</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tenants..."
                className="pl-9"
                value={searchTenant}
                onChange={(e) => setSearchTenant(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tenant.billing_plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => impersonateTenant(tenant.id, tenant.name)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View As
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
