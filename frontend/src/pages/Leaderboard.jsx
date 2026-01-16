import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, CheckCircle, XCircle, Building, Shield, Award, Filter, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Leaderboard = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);

  const API_BASE = 'http://localhost:8000';

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.leaderboard) {
        setCompanies(data.leaderboard);
        setLastUpdated(new Date(data.timestamp || new Date().toISOString()));
      } else {
        setCompanies([]);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Failed to load leaderboard data. Please try again.');
      setCompanies([]); // Clear any previous data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredCompanies = filter === 'all' 
    ? companies 
    : companies.filter(company => 
        filter === 'compliant' ? company.is_compliant :
        filter === 'deficit' ? !company.is_compliant :
        company.status === filter
      );

  const getReputationColor = (grade) => {
    if (!grade) return 'bg-gray-500';
    if (grade.includes('AAA')) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (grade.includes('AA')) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    if (grade.includes('B')) return 'bg-gradient-to-r from-red-500 to-orange-500';
    return 'bg-gray-500';
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: { label: 'Active', color: 'bg-blue-100 text-blue-800' },
      audited: { label: 'Audited', color: 'bg-green-100 text-green-800' },
      deficit: { label: 'Deficit', color: 'bg-red-100 text-red-800' },
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' }
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  // Calculate statistics
  const totalCompanies = companies.length;
  const compliantCompanies = companies.filter(c => c.is_compliant).length;
  const deficitCompanies = companies.filter(c => !c.is_compliant).length;
  const avgSurplus = companies.length > 0 
    ? Math.round(companies.reduce((acc, c) => acc + (c.net_surplus || 0), 0) / companies.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full mb-4">
            <Trophy className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Carbon Credit Leaderboard
          </h1>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            Track company performance, compliance status, and reputation in carbon credit management
          </p>
          
          {lastUpdated && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchLeaderboard}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Companies</p>
                  <p className="text-3xl font-bold text-gray-900">{totalCompanies}</p>
                </div>
                <Building className="h-10 w-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Compliant</p>
                  <p className="text-3xl font-bold text-green-700">
                    {compliantCompanies}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">In Deficit</p>
                  <p className="text-3xl font-bold text-red-700">
                    {deficitCompanies}
                  </p>
                </div>
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Surplus</p>
                  <p className="text-3xl font-bold text-emerald-700">
                    {avgSurplus} tons
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700">Filter by:</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Showing {filteredCompanies.length} of {companies.length} companies
            </span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="deficit">In Deficit</SelectItem>
                <SelectItem value="audited">Audited</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deficit">Deficit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Leaderboard Table */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
            <CardTitle className="text-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6" />
                Company Rankings
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchLeaderboard}
                className="bg-white/10 hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription className="text-gray-300">
              Sorted by Net Surplus (Highest to Lowest)
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
                <p className="mt-4 text-gray-600">Loading leaderboard data...</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No company data available</p>
                <p className="text-sm text-gray-500 mt-2">
                  Register companies through the Uploads page to see them here
                </p>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-12 text-center">
                <Filter className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No companies match the current filter</p>
                <Button 
                  variant="outline" 
                  onClick={() => setFilter('all')}
                  className="mt-4"
                >
                  Show All Companies
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12 text-center">Rank</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Allowance</TableHead>
                    <TableHead className="text-center">Consumption</TableHead>
                    <TableHead className="text-center">Surplus/Deficit</TableHead>
                    <TableHead className="text-center">Reputation</TableHead>
                    <TableHead className="text-center">Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies
                    .sort((a, b) => (b.net_surplus || 0) - (a.net_surplus || 0))
                    .map((company, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="text-center font-bold">
                          <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-gray-900">{company.company || 'Unknown'}</p>
                            <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
                              {company.wallet || 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(company.status)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-gray-900">
                          {company.total_allowance || 0} tons
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <span className="font-semibold">{company.actual_used || 0} tons</span>
                            {company.penalty_applied && (
                              <Badge variant="destructive" className="text-xs">
                                +{company.penalty_tons || 0} penalty
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {(company.net_surplus || 0) >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span className={`font-bold ${
                              (company.net_surplus || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {(company.net_surplus || 0) >= 0 ? '+' : ''}{company.net_surplus || 0} tons
                            </span>
                          </div>
                          {company.total_allowance > 0 && (
                            <Progress 
                              value={((company.actual_used || 0) / company.total_allowance) * 100} 
                              className="h-1 mt-2 max-w-[100px] mx-auto"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${getReputationColor(company.reputation_grade)} text-white`}>
                            {(company.reputation_grade || 'N/A').split(' ')[0]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {company.is_compliant ? (
                            <div className="inline-flex items-center gap-1 text-green-700">
                              <CheckCircle className="h-4 w-4" />
                              <span>Compliant</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-red-700">
                              <Shield className="h-4 w-4" />
                              <span>Action Required</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reputation Grades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">AAA</Badge>
                <span className="text-sm text-gray-600">Excellent (≤90% usage)</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">AA</Badge>
                <span className="text-sm text-gray-600">Good (≤100% usage)</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white">B</Badge>
                <span className="text-sm text-gray-600">Debtor (1.5x penalty)</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Audited - Fully verified</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">Active - Initial phase</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Deficit - Needs credits</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Allowance: Initial carbon credits allocated</li>
                <li>• Consumption: Actual carbon used (from audit)</li>
                <li>• Surplus: Credits remaining after consumption</li>
                <li>• Penalty: 1.5x multiplier for over-consumption</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;