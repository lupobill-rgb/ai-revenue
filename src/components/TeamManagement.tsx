import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Mail, Trash2, Shield, User, Crown, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

// Type-safe query helper for team_invitations table
const teamInvitationsTable = () => supabase.from("team_invitations" as any);

export default function TeamManagement() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserEmail(user.email || null);
    }
  };

  const fetchTeamMembers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await teamInvitationsTable()
      .select("*")
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("Error fetching team members:", error);
      setTeamMembers([]);
    } else {
      setTeamMembers((data || []) as unknown as TeamMember[]);
    }
    setLoading(false);
  };

  const sendInvitation = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInviting(false);
      return;
    }

    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    const tenantId = userTenant?.tenant_id || user.id;

    const { error } = await teamInvitationsTable()
      .insert({
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invited_by: user.id,
        tenant_id: tenantId,
        status: "pending",
      });

    setInviting(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Already Invited",
          description: "This user has already been invited to the team",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send invitation",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}`,
      });
      setInviteEmail("");
      fetchTeamMembers();
    }
  };

  const resendInvitation = async (member: TeamMember) => {
    setResending(member.id);
    
    // Update the invited_at timestamp to trigger re-send
    const { error } = await teamInvitationsTable()
      .update({ invited_at: new Date().toISOString() })
      .eq("id", member.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Invitation Resent",
        description: `Invitation resent to ${member.email}`,
      });
      fetchTeamMembers();
    }
    setResending(null);
  };

  const removeTeamMember = async (id: string) => {
    const { error } = await teamInvitationsTable()
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Removed",
        description: "Team member removed successfully",
      });
      fetchTeamMembers();
    }
  };

  const updateRole = async (id: string, newRole: string) => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only admins can change roles",
        variant: "destructive",
      });
      return;
    }

    const { error } = await teamInvitationsTable()
      .update({ role: newRole })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Updated",
        description: "Role updated successfully",
      });
      fetchTeamMembers();
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="h-4 w-4" />;
      case "editor":
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case "admin":
        return "default";
      case "editor":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadge = (status: string, invitedAt: string) => {
    const inviteDate = new Date(invitedAt);
    const now = new Date();
    const daysSinceInvite = Math.floor((now.getTime() - inviteDate.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysSinceInvite > 7 && status === "pending";

    if (status === "accepted") {
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Accepted
        </Badge>
      );
    }

    if (isExpired) {
      return (
        <Badge variant="destructive">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Invite New Member - Only show for admins */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserPlus className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Invite Team Member</CardTitle>
                <CardDescription>
                  Add new users to your workspace. They'll receive an email invitation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvitation()}
                />
              </div>
              <div className="w-full sm:w-40 space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={sendInvitation} disabled={inviting}>
                  <Mail className="h-4 w-4 mr-2" />
                  {inviting ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              <strong>Viewer:</strong> Can view campaigns and reports. <strong>Editor:</strong> Can create and edit campaigns. <strong>Admin:</strong> Full access including settings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {isAdmin ? "Manage your team's access and permissions" : "View your team members"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : teamMembers.length === 0 && !currentUserEmail ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No team members yet</p>
              {isAdmin && <p className="text-sm">Invite colleagues to collaborate on campaigns</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Current user (owner) */}
              {currentUserEmail && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{currentUserEmail}</p>
                      <p className="text-sm text-muted-foreground">Account Owner</p>
                    </div>
                  </div>
                  <Badge variant="default">Owner</Badge>
                </div>
              )}

              {/* Team members */}
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {getRoleIcon(member.role)}
                    </div>
                    <div>
                      <p className="font-medium">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(member.status, member.invited_at)}
                        {member.invited_at && (
                          <span className="text-xs text-muted-foreground">
                            {member.status === "accepted" && member.accepted_at
                              ? `Joined ${formatDistanceToNow(new Date(member.accepted_at), { addSuffix: true })}`
                              : `Invited ${formatDistanceToNow(new Date(member.invited_at), { addSuffix: true })}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Resend button for pending invitations */}
                    {member.status === "pending" && isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInvitation(member)}
                        disabled={resending === member.id}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${resending === member.id ? "animate-spin" : ""}`} />
                        Resend
                      </Button>
                    )}

                    {/* Role selector - only for admins */}
                    {isAdmin ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateRole(member.id, value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    )}

                    {/* Delete button - only for admins */}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamMember(member.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
