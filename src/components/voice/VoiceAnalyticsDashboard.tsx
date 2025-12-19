/**
 * Voice Analytics Dashboard
 * Shows real analytics with timeframe selector
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, PhoneCall, Clock, BarChart3, CheckCircle2, XCircle, PhoneMissed } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { VoiceAnalytics, VoiceCallRecord } from '@/hooks/useVoiceData';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface VoiceAnalyticsDashboardProps {
  analytics: VoiceAnalytics;
  callRecords: VoiceCallRecord[];
  timeframeDays: number;
  onTimeframeChange: (days: number) => void;
  lastUpdated?: Date;
}

export function VoiceAnalyticsDashboard({
  analytics,
  callRecords,
  timeframeDays,
  onTimeframeChange,
  lastUpdated,
}: VoiceAnalyticsDashboardProps) {
  // Calculate calls over time for chart
  const callsOverTimeData = useMemo(() => {
    const days = Math.min(timeframeDays, 30);
    const result: { date: string; calls: number; completed: number; failed: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      
      const dayCalls = callRecords.filter(c => c.created_at?.startsWith(dateStr));
      const completedCalls = dayCalls.filter(c => c.status === 'completed').length;
      const failedCalls = dayCalls.filter(c => c.status === 'failed' || c.status === 'no-answer').length;
      
      result.push({ 
        date: dayLabel, 
        calls: dayCalls.length,
        completed: completedCalls,
        failed: failedCalls,
      });
    }
    return result;
  }, [callRecords, timeframeDays]);

  const callsByStatusData = useMemo(() => {
    return Object.entries(analytics.callsByStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
      value,
    }));
  }, [analytics.callsByStatus]);

  const callsByTypeData = useMemo(() => {
    return Object.entries(analytics.callsByType).map(([name, value]) => ({
      name: name === 'outbound' ? 'Outbound' : 'Inbound',
      value,
    }));
  }, [analytics.callsByType]);

  const hasData = analytics.totalCalls > 0;

  return (
    <div className="space-y-6">
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics</h3>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Select value={timeframeDays.toString()} onValueChange={(v) => onTimeframeChange(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No call activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start making calls to see analytics
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <PhoneCall className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{analytics.totalCalls}</p>
                    <p className="text-xs text-muted-foreground">Total Calls</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{analytics.completedCalls}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10">
                    <PhoneMissed className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{analytics.noAnswerCalls}</p>
                    <p className="text-xs text-muted-foreground">No Answer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{analytics.averageCallDuration}s</p>
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Call Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsOverTimeData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Calls" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Type</CardTitle>
              </CardHeader>
              <CardContent>
                {callsByTypeData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={callsByTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {callsByTypeData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          iconType="circle" 
                          iconSize={8}
                          wrapperStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-12">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Status</CardTitle>
              </CardHeader>
              <CardContent>
                {callsByStatusData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={callsByStatusData} layout="vertical" barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          allowDecimals={false}
                        />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                          width={80}
                        />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-12">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
