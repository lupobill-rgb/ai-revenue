import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoMode } from "@/hooks/useDemoMode";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video as VideoIcon, Play, Eye, Clock, TrendingUp, Sparkles, Database, Plus, Loader2 } from "lucide-react";
import AIPromptCard from "@/components/AIPromptCard";

const SAMPLE_VIDEOS = [
  {
    id: "video-1",
    name: "Q1 Product Launch Campaign",
    description: "High-energy promotional video showcasing new product features",
    status: "live",
    views: 45200,
    duration: "0:45",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    created_at: "2024-11-20",
    engagement: 12.4,
  },
  {
    id: "video-2",
    name: "Company Overview Video",
    description: "Brand story and value proposition overview",
    status: "live",
    views: 32100,
    duration: "2:30",
    thumbnail: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80",
    created_at: "2024-11-18",
    engagement: 8.7,
  },
  {
    id: "video-3",
    name: "Customer Success Story",
    description: "Client testimonial showcasing ROI and results",
    status: "approved",
    views: 18500,
    duration: "1:15",
    thumbnail: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80",
    created_at: "2024-11-22",
    engagement: 15.2,
  },
  {
    id: "video-4",
    name: "Industry Thought Leadership",
    description: "Expert insights and market trends analysis",
    status: "review",
    views: 0,
    duration: "3:00",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    created_at: "2024-11-25",
    engagement: 0,
  },
];

const verticals = [
  "Accounting & Finance",
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture & Farming",
  "Automotive",
  "Banking & Financial Services",
  "Biotechnology & Pharmaceuticals",
  "Construction & Engineering",
  "Consulting & Professional Services",
  "Consumer Goods & Retail",
  "E-commerce",
  "Education & Training",
  "Energy & Utilities",
  "Entertainment & Media",
  "Environmental Services",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Human Resources & Staffing",
  "Information Technology",
  "Insurance",
  "Legal Services",
  "Logistics & Transportation",
  "Manufacturing",
  "Non-Profit & NGO",
  "Real Estate & Property",
  "Restaurants & Food Service",
  "SaaS & Software",
  "Sports & Recreation",
  "Telecommunications",
  "Travel & Leisure",
];

const Video = () => {
  const navigate = useNavigate();
  // DEMO MODE: Use centralized workspace demo_mode instead of local toggle
  const { demoMode: showSampleData } = useDemoMode();
  const [vertical, setVertical] = useState("");
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      live: "bg-green-500/10 text-green-500 border-green-500/20",
      approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      draft: "bg-muted text-muted-foreground",
    };
    return colors[status] || colors.draft;
  };

  const totalViews = SAMPLE_VIDEOS.reduce((acc, v) => acc + v.views, 0);
  const avgEngagement = (SAMPLE_VIDEOS.filter(v => v.engagement > 0).reduce((acc, v) => acc + v.engagement, 0) / SAMPLE_VIDEOS.filter(v => v.engagement > 0).length).toFixed(1);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                  <VideoIcon className="h-8 w-8" />
                  Video Studio
                </h1>
                <p className="text-muted-foreground">
                  AI-powered marketing videos for your campaigns
                </p>
              </div>
              {/* Demo mode badge - controlled from Settings */}
              {showSampleData && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Database className="h-3 w-3 mr-1" />
                  SAMPLE DATA
                </Badge>
              )}
            </div>

            {showSampleData && (
              <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
                <Database className="h-4 w-4" />
                Showing sample demo data. Disable Sample Data Mode in Settings to view real data only.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <VideoIcon className="h-4 w-4" />
                    <span className="text-sm">Total Videos</span>
                  </div>
                  <div className="text-2xl font-bold">{SAMPLE_VIDEOS.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Total Views</span>
                  </div>
                  <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Avg. Engagement</span>
                  </div>
                  <div className="text-2xl font-bold">{avgEngagement}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Play className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Live Videos</span>
                  </div>
                  <div className="text-2xl font-bold text-green-500">
                    {SAMPLE_VIDEOS.filter(v => v.status === "live").length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Create New Video */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Create AI Video
                    </CardTitle>
                    <CardDescription>
                      Generate marketing videos with AI (Coming Soon)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Industry Vertical</Label>
                      <Select value={vertical} onValueChange={setVertical}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {verticals.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Video Goal</Label>
                      <Input
                        placeholder="e.g., Product demo, Testimonial"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" disabled>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Video (Coming Soon)
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      AI video generation with Veo 3.1 - launching soon
                    </p>
                  </CardContent>
                </Card>

                <AIPromptCard
                  title="Video Strategy Help"
                  description="Get AI assistance with video marketing"
                  prompts={[
                    "What's the ideal video length for social media?",
                    "Give me 5 video ideas for my industry",
                    "How can I improve video engagement rates?",
                  ]}
                />
              </div>

              {/* Recent Videos */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Videos</h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/assets")}>
                    View All
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SAMPLE_VIDEOS.map((video) => (
                    <Card 
                      key={video.id} 
                      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                      onClick={() => navigate("/assets")}
                    >
                      <div className="relative aspect-video bg-muted">
                        <img 
                          src={video.thumbnail} 
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
                            <Play className="h-8 w-8 text-white fill-white" />
                          </div>
                        </div>
                        <Badge className={`absolute top-2 right-2 ${getStatusBadge(video.status)}`}>
                          {video.status}
                        </Badge>
                        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {video.duration}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold line-clamp-1 mb-1">{video.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                          {video.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {video.views.toLocaleString()} views
                          </span>
                          <span>{video.created_at}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Video;
