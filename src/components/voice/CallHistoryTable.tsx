/**
 * Call History Table Component
 * Displays recent calls with transcripts and analysis
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  PhoneIncoming,
  PhoneOutgoing,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Clock,
  MessageSquare,
} from 'lucide-react';
import type { VoiceCall } from '@/lib/voice/types';

interface CallHistoryTableProps {
  calls: VoiceCall[];
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ended: 'bg-green-500/10 text-green-500',
  'no-answer': 'bg-yellow-500/10 text-yellow-500',
  busy: 'bg-orange-500/10 text-orange-500',
  failed: 'bg-red-500/10 text-red-500',
  'in-progress': 'bg-blue-500/10 text-blue-500',
  queued: 'bg-muted text-muted-foreground',
  ringing: 'bg-blue-500/10 text-blue-500',
};

const OUTCOME_COLORS: Record<string, string> = {
  interested: 'bg-green-500/10 text-green-500',
  booked: 'bg-purple-500/10 text-purple-500',
  callback: 'bg-blue-500/10 text-blue-500',
  not_interested: 'bg-muted text-muted-foreground',
  no_answer: 'bg-yellow-500/10 text-yellow-500',
};

export function CallHistoryTable({ calls, isLoading }: CallHistoryTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading calls...
        </CardContent>
      </Card>
    );
  }

  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No calls yet. Start a campaign to make your first call.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Recent Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <Collapsible key={call.id} asChild>
                  <>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        {call.type === 'inboundPhoneCall' ? (
                          <PhoneIncoming className="h-4 w-4 text-blue-500" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{call.customer?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {call.customer?.number || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">
                          {call.type.replace('PhoneCall', '')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[call.status] || 'bg-muted'}>
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {call.analysis?.outcome ? (
                          <Badge className={OUTCOME_COLORS[call.analysis.outcome] || 'bg-muted'}>
                            {call.analysis.outcome.replace('_', ' ')}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(call.createdAt)}
                      </TableCell>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleExpanded(call.id)}
                          >
                            {expandedIds.has(call.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="p-4">
                          <div className="space-y-3">
                            {/* Summary */}
                            {call.summary && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Summary
                                </p>
                                <p className="text-sm">{call.summary}</p>
                              </div>
                            )}

                            {/* Key Points */}
                            {call.analysis?.keyPoints && call.analysis.keyPoints.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Key Points
                                </p>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                  {call.analysis.keyPoints.map((point, i) => (
                                    <li key={i}>{point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Next Action */}
                            {call.analysis?.nextAction && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Next Action
                                </p>
                                <p className="text-sm">{call.analysis.nextAction}</p>
                              </div>
                            )}

                            {/* Recording */}
                            {call.recordingUrl && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setPlayingId(playingId === call.id ? null : call.id)
                                  }
                                >
                                  {playingId === call.id ? (
                                    <Pause className="h-4 w-4 mr-1" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-1" />
                                  )}
                                  {playingId === call.id ? 'Pause' : 'Play Recording'}
                                </Button>
                              </div>
                            )}

                            {/* Transcript */}
                            {call.transcript && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Transcript
                                </p>
                                <ScrollArea className="h-[100px] rounded border p-2">
                                  <p className="text-sm whitespace-pre-wrap">{call.transcript}</p>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
