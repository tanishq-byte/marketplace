import React, { useState, useEffect } from 'react';
import { 
  Trophy, TrendingUp, TrendingDown, CheckCircle, XCircle, 
  Building, Shield, Award, Filter, RefreshCw, ChevronDown, 
  ChevronUp, Link as LinkIcon, Fingerprint, Activity,
  AlertTriangle, CircleCheck, CircleDashed, DollarSign, Flame
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const Leaderboard = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('table');

  const API_BASE = 'http://localhost:8000';

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.leaderboard) {
        setCompanies(data.leaderboard);
        setLastUpdated(new Date());
      } else {
        throw new Error('No leaderboard data received');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Failed to load leaderboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  // Calculate compliance based on your backend logic
  const isCompliant = (company) => {
    // Your backend returns 'grade' field with values like "AAA", "AA", "B (Debtor)"
    return !company.grade?.includes('B (Debtor)');
  };

  const getComplianceBadge = (company) => {
    if (company.grade?.includes('AAA')) return { text: 'AAA', class: 'bg-green-500 text-white' };
    if (company.grade?.includes('AA')) return { text: 'AA', class: 'bg-blue-500 text-white' };
    if (company.grade?.includes('B (Debtor)')) return { text: 'DEBTOR', class: 'bg-red-500 text-white' };
    return { text: 'UNKNOWN', class: 'bg-gray-500 text-white' };
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'audited': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'deficit': return 'bg-red-100 text-red-800';
      case 'pending_settlement': return 'bg-yellow-100 text-yellow-800';
      case 'ready_to_burn': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCompanies = companies.filter(company => {
    if (filter === 'all') return true;
    if (filter === 'compliant') return isCompliant(company);
    if (filter === 'deficit') return !isCompliant(company);
    if (filter === 'top') return company.net_surplus > 0;
    if (filter === 'debtors') return company.net_surplus < 0;
    return company.status === filter;
  });

  // Sort by net surplus (highest first)
  const sortedCompanies = [...filteredCompanies].sort((a, b) => b.net_surplus - a.net_surplus);

  // Calculate penalty for display
  const calculatePenalty = (company) => {
    if (company.last_verified_consumption > company.initial_allowance) {
      const excess = company.last_verified_consumption - company.initial_allowance;
      return excess * 0.5; // 1.5x penalty on excess
    }
    return 0;
  };

  const formatWalletAddress = (address) => {
    if (!address || address === 'N/A') return 'No wallet';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getGradeIcon = (grade) => {
    if (grade?.includes('AAA')) return <CircleCheck className="h-4 w-4 text-green-600" />;
    if (grade?.includes('AA')) return <CircleCheck className="h-4 w-4 text-blue-600" />;
    if (grade?.includes('B (Debtor)')) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    return <CircleDashed className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Environmental Leaderboard</h1>
                <p className="text-slate-600 mt-1">Real-time carbon surplus rankings & compliance tracking</p>
              </div>
            </div>
            
            {lastUpdated && (
              <div className="flex items-center gap-2 mt-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-slate-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[160px] bg-white border-slate-200 shadow-sm">
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  <SelectItem value="compliant">Compliant Only</SelectItem>
                  <SelectItem value="debtors">In Debt</SelectItem>
                  <SelectItem value="top">Surplus Leaders</SelectItem>
                  <SelectItem value="audited">Audited</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={fetchLeaderboard} 
                variant="outline" 
                className="bg-white shadow-sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Companies</p>
                  <p className="text-2xl font-bold text-slate-900">{companies.length}</p>
                </div>
                <Building className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Surplus</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {companies.reduce((sum, c) => sum + Math.max(0, c.net_surplus || 0), 0)}t
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Deficit</p>
                  <p className="text-2xl font-bold text-rose-600">
                    {Math.abs(companies.reduce((sum, c) => sum + Math.min(0, c.net_surplus || 0), 0))}t
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-rose-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Compliance Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {companies.length > 0 
                      ? `${Math.round((companies.filter(isCompliant).length / companies.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && companies.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="h-10 w-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-600">Loading leaderboard data...</p>
              </div>
            </CardContent>
          </Card>
        ) : companies.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="flex flex-col items-center justify-center gap-4">
                <Trophy className="h-12 w-12 text-slate-300" />
                <p className="text-slate-600">No companies registered yet. Be the first to mint credits!</p>
                <Button onClick={() => window.location.href = '/'}>
                  Go to Registration
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-bold text-slate-700">Rank & Company</TableHead>
                  <TableHead className="font-bold text-slate-700">Reputation</TableHead>
                  <TableHead className="font-bold text-slate-700 text-right">Allowance</TableHead>
                  <TableHead className="font-bold text-slate-700 text-right">Consumed</TableHead>
                  <TableHead className="font-bold text-slate-700 text-right">Net Surplus</TableHead>
                  <TableHead className="font-bold text-slate-700 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCompanies.map((company, index) => {
                  const isExpanded = expandedRow === index;
                  const penalty = calculatePenalty(company);
                  const complianceBadge = getComplianceBadge(company);
                  const utilizationRate = company.initial_allowance > 0 
                    ? (company.last_verified_consumption / company.initial_allowance) * 100 
                    : 0;

                  return (
                    <React.Fragment key={index}>
                      <TableRow 
                        className={`cursor-pointer transition-all hover:bg-slate-50/50 ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleRow(index)}
                      >
                        <TableCell className="text-center">
                          {isExpanded ? 
                            <ChevronUp className="h-4 w-4 text-blue-500" /> : 
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          }
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                              index < 3 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">{company.company}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Fingerprint className="h-3 w-3 text-slate-400" />
                                <span className="text-xs font-mono text-slate-500">
                                  {formatWalletAddress(company.wallet_address)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getGradeIcon(company.grade)}
                            <Badge className={complianceBadge.class}>
                              {complianceBadge.text}
                            </Badge>
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="font-semibold text-slate-900">{company.initial_allowance || 0}t</div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="font-semibold text-slate-900">{company.last_verified_consumption || 0}t</div>
                          {penalty > 0 && (
                            <div className="text-xs text-rose-600">+{penalty.toFixed(1)}t penalty</div>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className={`text-lg font-bold ${company.net_surplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {company.net_surplus > 0 ? '+' : ''}{company.net_surplus || 0}t
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <Badge className={`${getStatusBadge(company.status)} font-medium`}>
                            {company.status?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <TableRow className="bg-blue-50/30">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                              
                              {/* Company Details */}
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                  <Activity className="h-4 w-4" /> Company Details
                                </h4>
                                <Card className="border border-slate-200">
                                  <CardContent className="pt-4 space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-slate-500">Full Wallet</span>
                                      <span className="font-mono text-sm text-slate-700 break-all text-right">
                                        {company.wallet_address || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-slate-500">Settlement TX</span>
                                      <span className="font-mono text-sm text-blue-600">
                                        {company.settlement_tx && company.settlement_tx !== 'N/A' ? 
                                          `${company.settlement_tx.substring(0, 12)}...` : 'Pending'
                                        }
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-slate-500">Compliance Result</span>
                                      <span className={`text-sm font-medium ${
                                        company.compliance_result === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'
                                      }`}>
                                        {company.compliance_result || 'PENDING'}
                                      </span>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Performance Metrics */}
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4" /> Performance
                                </h4>
                                <Card className="border border-slate-200">
                                  <CardContent className="pt-4 space-y-4">
                                    <div>
                                      <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-500">Utilization Rate</span>
                                        <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                                      </div>
                                      <Progress 
                                        value={utilizationRate} 
                                        className={`h-2 ${utilizationRate <= 90 ? 'bg-emerald-100' : 'bg-rose-100'}`}
                                      />
                                      <p className="text-xs text-slate-500 mt-1">
                                        {utilizationRate <= 90 ? 'Excellent efficiency' : 'Above allowance'}
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="text-center p-2 bg-emerald-50 rounded">
                                        <p className="text-xs text-emerald-700">Penalty Applied</p>
                                        <p className="font-bold text-emerald-800">{penalty > 0 ? 'Yes' : 'No'}</p>
                                      </div>
                                      <div className="text-center p-2 bg-blue-50 rounded">
                                        <p className="text-xs text-blue-700">Required Burn</p>
                                        <p className="font-bold text-blue-800">
                                          {(company.last_verified_consumption + penalty).toFixed(1)}t
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Actions & Status */}
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                  <Award className="h-4 w-4" /> Status & Actions
                                </h4>
                                <Card className="border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                                  <CardContent className="pt-4">
                                    <div className="mb-4">
                                      <p className="text-xs text-slate-300 mb-1">Current Position</p>
                                      <p className="text-xl font-bold">
                                        #{index + 1} on Leaderboard
                                      </p>
                                    </div>
                                    
                                    {company.net_surplus < 0 && (
                                      <div className="mb-4 p-3 bg-rose-900/30 rounded border border-rose-800/50">
                                        <div className="flex items-center gap-2 mb-2">
                                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                                          <p className="text-sm font-medium text-rose-200">Deficit Detected</p>
                                        </div>
                                        <p className="text-xs text-slate-300 mb-3">
                                          Needs {Math.abs(company.net_surplus).toFixed(1)} more tokens
                                        </p>
                                        <Button 
                                          size="sm" 
                                          className="w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white"
                                          onClick={() => window.location.href = '/marketplace'}
                                        >
                                          <DollarSign className="h-3 w-3 mr-2" />
                                          Buy from Marketplace
                                        </Button>
                                      </div>
                                    )}
                                    
                                    {company.status === 'ready_to_burn' && (
                                      <div className="p-3 bg-emerald-900/30 rounded border border-emerald-800/50">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Flame className="h-4 w-4 text-emerald-400" />
                                          <p className="text-sm font-medium text-emerald-200">Ready to Settle</p>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                          Company can burn {(company.last_verified_consumption + penalty).toFixed(1)} tokens
                                        </p>
                                      </div>
                                    )}

                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full mt-4 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                                      onClick={() => window.open(`/audit?company=${encodeURIComponent(company.company)}`, '_blank')}
                                    >
                                      View Audit Details
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {/* Footer Stats */}
            {sortedCompanies.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-slate-600">
                    Showing {sortedCompanies.length} of {companies.length} companies • 
                    Sorted by Net Surplus • {filter !== 'all' && `Filter: ${filter}`}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                      <span className="text-xs text-slate-600">Surplus: {companies.filter(c => c.net_surplus > 0).length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                      <span className="text-xs text-slate-600">Deficit: {companies.filter(c => c.net_surplus < 0).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Legend & Help Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Reputation Grades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-green-500 text-white">AAA</Badge>
                <span className="text-sm text-slate-600">Excellent (&lt;90% usage)</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-500 text-white">AA</Badge>
                <span className="text-sm text-slate-600">Good (90-100% usage)</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-red-500 text-white">B (DEBTOR)</Badge>
                <span className="text-sm text-slate-600">Over consumption with deficit</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Status Meanings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">AUDITED</Badge>
                <span className="text-sm text-slate-600">Settlement complete</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">ACTIVE</Badge>
                <span className="text-sm text-slate-600">Phase 1 complete</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800">DEFICIT</Badge>
                <span className="text-sm text-slate-600">Needs more tokens</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Leaderboard updates automatically every 30 seconds.
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.location.href = '/'}
                >
                  Register Company
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.location.href = '/marketplace'}
                >
                  Visit Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;