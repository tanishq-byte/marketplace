import React, { useState, useEffect } from 'react';
import { 
  Trophy, TrendingUp, TrendingDown, CheckCircle, XCircle, 
  Building, Shield, Award, Filter, RefreshCw, ChevronDown, 
  ChevronUp, Link as LinkIcon, Fingerprint, Activity 
} from 'lucide-react';
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
  const [expandedRow, setExpandedRow] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API_BASE = 'http://localhost:8000';

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.leaderboard) {
        setCompanies(data.leaderboard);
        setLastUpdated(new Date());
        console.log(lastUpdated)
      }
    } catch (err) {
      setError('Failed to load leaderboard data.', err);
      alert(error)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  const isCompliant = (company) => 
    company.compliance_result === 'SUCCESS' || company.net_surplus >= 0;

  const filteredCompanies = companies.filter(company => {
    if (filter === 'all') return true;
    if (filter === 'compliant') return isCompliant(company);
    if (filter === 'deficit') return !isCompliant(company);
    return company.status === filter;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-400 rounded-lg shadow-sm">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Environmental Ledger</h1>
            </div>
            <p className="text-slate-500">Full audit trail and real-time carbon surplus rankings</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px] bg-white border-slate-200">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="deficit">Non-Compliant</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="audited">Audited</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchLeaderboard} variant="outline" className="bg-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </div>

        {/* Main Table Card */}
        <Card className="border-none shadow-xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-bold text-slate-700">Company & Identity</TableHead>
                <TableHead className="text-center font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Allowance</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Consumption</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Net Surplus</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company, index) => {
                const compliant = isCompliant(company);
                const isExpanded = expandedRow === index;

                return (
                  <React.Fragment key={index}>
                    <TableRow 
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      onClick={() => toggleRow(index)}
                    >
                      <TableCell className="text-center">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{company.company}</span>
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" /> {company.wallet_address.substring(0, 10)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-medium uppercase text-[10px]">
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{company.initial_allowance}t</TableCell>
                      <TableCell className="text-right font-semibold">{company.last_verified_consumption}t</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${company.net_surplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {company.net_surplus > 0 ? '+' : ''}{company.net_surplus}t
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Badge className={`${compliant ? 'bg-emerald-500' : 'bg-rose-500'} text-white border-none`}>
                           {compliant ? 'VALID' : 'DEFICIT'}
                         </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Section - DISPLAYS ALL REMAINING DATA */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/80">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                            
                            {/* Technical Identity */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="h-3 w-3" /> Blockchain Identity
                              </h4>
                              <div className="bg-white p-3 rounded-md border border-slate-200">
                                <p className="text-[10px] text-slate-400 mb-1">Full Wallet Address</p>
                                <p className="text-xs font-mono break-all text-slate-700">{company.wallet_address}</p>
                              </div>
                              <div className="bg-white p-3 rounded-md border border-slate-200">
                                <p className="text-[10px] text-slate-400 mb-1">Settlement Hash</p>
                                <p className="text-xs font-mono break-all text-blue-600 flex items-center gap-2">
                                  {company.settlement_tx}
                                  <LinkIcon className="h-3 w-3 cursor-pointer hover:text-blue-800" />
                                </p>
                              </div>
                            </div>

                            {/* Compliance Audit */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Shield className="h-3 w-3" /> Compliance Details
                              </h4>
                              <div className="bg-white p-4 rounded-md border border-slate-200 h-full">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-sm text-slate-600">Audit Status</span>
                                  <Badge className={company.compliance_result === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                    {company.compliance_result}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Utilization Rate</span>
                                    <span className="font-bold">
                                      {company.initial_allowance > 0 
                                        ? Math.round((company.last_verified_consumption / company.initial_allowance) * 100) 
                                        : 0}%
                                    </span>
                                  </div>
                                  <Progress 
                                    value={(company.last_verified_consumption / company.initial_allowance) * 100} 
                                    className={`h-2 ${compliant ? 'bg-slate-200' : 'bg-rose-100'}`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Summary Card */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Award className="h-3 w-3" /> Summary
                              </h4>
                              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-md text-white">
                                <p className="text-xs text-slate-400 mb-1">Total Impact</p>
                                <p className="text-lg font-bold">
                                  {company.net_surplus >= 0 
                                    ? `Saved ${company.net_surplus} Tons` 
                                    : `Owes ${Math.abs(company.net_surplus)} Tons`}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                                  This data was verified via the settlement transaction hash provided on-chain.
                                </p>
                              </div>
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
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;