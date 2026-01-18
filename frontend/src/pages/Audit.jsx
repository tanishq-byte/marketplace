import React, { useState } from 'react';
import { Search, FileCheck, AlertTriangle, CheckCircle, Clock, DollarSign, Shield, TrendingDown, ExternalLink, Eye, EyeOff, XCircle, Upload, Key, Lock, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ethers } from 'ethers';
import CarbonABI from '../pages/abi.js'; // Import the ABI

const Audit = () => {
  const [companyName, setCompanyName] = useState('');
  const [companyData, setCompanyData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showWallet, setShowWallet] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [privateKey, setPrivateKey] = useState('');
  const [contractAddress, setContractAddress] = useState('0x8b38F7d3da2c4A3eDA5c7d5873B4236ca916d0b0');
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');

  const API_BASE = 'http://localhost:8000';

  // Function to search for company data - Updated to match your backend
  const handleSearch = async () => {
    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    setSearchLoading(true);
    setError('');
    setCompanyData(null);
    setAuditResult(null);
    setFile(null);

    try {
      // Get leaderboard data and find company
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      if (data.leaderboard) {
        const company = data.leaderboard.find(c => 
          c.company.toLowerCase() === companyName.toLowerCase()
        );
        
        if (company) {
          setCompanyData(company);
        } else {
          setError('Company not found in leaderboard. Please verify the company name.');
        }
      } else {
        throw new Error('No leaderboard data received');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search for company. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFileChange = (selectedFile) => {
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        // Check file size (10MB limit)
        if (selectedFile.size > 10 * 1024 * 1024) {
          setError('File size must be less than 10MB');
          return;
        }
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload a PDF file only');
      }
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileChange(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    handleFileChange(droppedFile);
  };

  const removeFile = () => {
    setFile(null);
    const fileInput = document.getElementById('auditReport');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleFileButtonClick = () => {
    document.getElementById('auditReport').click();
  };

  const simulateProgress = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 90) {
        clearInterval(interval);
      }
    }, 200);
    return interval;
  };

  // Direct blockchain call for retiring credits
  const handleDirectRetire = async () => {
    if (!privateKey || !contractAddress) {
      setError('Please enter private key and contract address');
      return;
    }

    if (!companyData || companyData.status === 'audited') {
      setError('Company not found or already audited');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Calculate required burn amount based on your backend logic
      const allowance = companyData.initial_allowance || 0;
      const lastConsumption = companyData.last_verified_consumption || 0;
      const requiredBurn = Math.max(lastConsumption, allowance); // Simplified for demo

      // Connect to blockchain
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(contractAddress, CarbonABI, wallet);

      // Check balance first
      const balance = await contract.balanceOf(wallet.address);
      console.log('Current balance:', balance.toString(), 'Required:', requiredBurn);

      if (BigInt(balance.toString()) < BigInt(requiredBurn)) {
        throw new Error(`Insufficient balance: ${balance.toString()} CCT available, ${requiredBurn} CCT required`);
      }

      // Call retireCredits function
      const tx = await contract.retireCredits(requiredBurn);
      console.log('Transaction sent:', tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);

      // Update local state
      setAuditResult({
        status: 'SUCCESS',
        company: companyData.company,
        blockchain_status: 'SUCCESS',
        blockchain_tx: receipt.hash,
        net_surplus: allowance - lastConsumption,
        actualConsumption: lastConsumption,
        penaltyApplied: lastConsumption > allowance,
        penaltyTons: lastConsumption > allowance ? (lastConsumption - allowance) * 0.5 : 0,
        totalRetirement: requiredBurn,
        surplus: allowance - lastConsumption
      });

      // Update company status in backend
      await updateCompanyStatus(companyData.company, receipt.hash);

      alert("Blockchain Settlement Successful!");

    } catch (err) {
      console.error('Blockchain error:', err);
      setError(`Blockchain Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Update company status in backend after successful burn
  const updateCompanyStatus = async (companyName, txHash) => {
    try {
      const response = await fetch(`${API_BASE}/api/update-audit-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: companyName,
          tx_hash: txHash,
          status: 'audited'
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to update backend status, but blockchain transaction succeeded');
      }
    } catch (err) {
      console.error('Failed to update backend:', err);
    }
  };

  const handleAuditSubmit = async () => {
    if (!companyData || !file || !privateKey) {
        setError('Please provide Company Name, Audit File, and Private Key');
        return;
    }

    setProcessing(true);
    setError('');
    const progressInterval = simulateProgress();

    try {
        // STEP 1: Upload to Backend for OCR and DB Update
        const formData = new FormData();
        formData.append('file', file);
        
        const ocrResponse = await fetch(`${API_BASE}/phase2-settlement/${encodeURIComponent(companyData.company)}`, {
            method: 'POST',
            body: formData,
        });
        
        const ocrResult = await ocrResponse.json();
        if (!ocrResponse.ok) throw new Error(ocrResult.detail || 'OCR failed');

        // STEP 2: Logic Branching based on OCR Result
        if (ocrResult.status === 'DEFICIT') {
            setAuditResult({
                status: 'DEFICIT',
                ...ocrResult // Show them they need to buy more
            });
            alert("Audit saved. Deficit detected. Purchase credits to settle.");
        } 
        else if (ocrResult.status === 'SETTLEMENT_SUCCESS' || ocrResult.status === 'BLOCKCHAIN_DELAY' || ocrResult.status === 'ready_to_burn') {
            
            // STEP 3: EXECUTE THE ACTUAL BLOCKCHAIN BURN FROM FRONTEND
            // This ensures the 600 tons are retired using the key YOU provided
            console.log("🚀 Starting Blockchain Burn...");
            
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);
            const contract = new ethers.Contract(contractAddress, CarbonABI, wallet);

            const amountToBurn = ocrResult.required_burn || 600; // Use OCR value
            
            // Build the transaction
            const tx = await contract.retireCredits(amountToBurn);
            const receipt = await tx.wait();

            // STEP 4: Tell the backend the burn is officially done
            await updateCompanyStatus(companyData.company, receipt.hash);

            setAuditResult({
                status: 'SUCCESS',
                blockchain_status: 'SUCCESS',
                blockchain_tx: receipt.hash,
                actualConsumption: ocrResult.actual_consumption,
                totalRetirement: amountToBurn,
                surplus: ocrResult.net_surplus
            });

            alert("Blockchain Settlement Successful! 600 Tons Retired.");
        }

    } catch (err) {
        console.error('Audit/Blockchain Error:', err);
        setError(`Error: ${err.message}`);
    } finally {
        clearInterval(progressInterval);
        setUploadProgress(100);
        setTimeout(() => setProcessing(false), 500);
    }
};

  const handleBuyCredits = () => {
    window.open('/marketplace', '_blank');
  };

  const handleTabSwitch = (value) => {
    if (value === 'audit' && !companyData) {
      setError('Please search and select a company first');
      return false;
    }
    return true;
  };

  // Validate private key format
  const isValidPrivateKey = (key) => {
    return key.length === 64 || (key.startsWith('0x') && key.length === 66);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center gap-3">
            <FileCheck className="h-10 w-10 text-purple-600" />
            Audit & Settlement Phase
          </h1>
          <p className="text-gray-600 text-lg">
            Verify actual carbon consumption and settle credits on the blockchain
          </p>
          <Alert className="mt-4 bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Development Mode</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Private key is requested for blockchain transactions. This is for testing only. In production, use MetaMask or secure wallet connections.
            </AlertDescription>
          </Alert>
        </div>

        <Tabs defaultValue="search" className="space-y-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="search" onClick={() => setError('')}>Search Company</TabsTrigger>
            <TabsTrigger 
              value="audit" 
              disabled={!companyData}
              onClick={() => handleTabSwitch('audit')}
            >
              Process Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Search className="h-6 w-6" />
                  Find Company Record
                </CardTitle>
                <CardDescription>
                  Search for a company to view their current carbon allowance and status
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="searchCompany">Company Name *</Label>
                      <Input
                        id="searchCompany"
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          setCompanyData(null);
                          setAuditResult(null);
                          setFile(null);
                          setError('');
                        }}
                        placeholder="Enter exact company name as registered"
                        className="mt-1 h-12"
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        disabled={searchLoading}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleSearch} 
                        disabled={searchLoading || !companyName.trim()}
                        className="h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        {searchLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Searching...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Search
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="animate-in slide-in-from-top duration-300">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="font-medium">{error}</AlertDescription>
                    </Alert>
                  )}

                  {companyData && (
                    <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-blue-200 animate-in fade-in duration-500">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold text-gray-900">{companyData.company}</h3>
                              <Badge className={
                                companyData.status === 'audited' ? 'bg-green-100 text-green-800' :
                                companyData.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                companyData.status === 'deficit' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {companyData.status || 'unknown'}
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Wallet Address:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">
                                    {showWallet 
                                      ? (companyData.wallet_address || 'N/A') 
                                      : `${(companyData.wallet_address || '0x').slice(0, 6)}...${(companyData.wallet_address || '').slice(-4)}`}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowWallet(!showWallet)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {showWallet ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Initial Allowance:</span>
                                <span className="font-bold text-green-700">{companyData.initial_allowance || 0} tons</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Last Verified Consumption:</span>
                                <span className="font-semibold">{companyData.last_verified_consumption || 0} tons</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Net Surplus:</span>
                                <span className={`font-bold ${(companyData.net_surplus || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {(companyData.net_surplus || 0) >= 0 ? '+' : ''}{companyData.net_surplus || 0} tons
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Reputation Grade:</span>
                                <Badge className={
                                  companyData.grade?.includes('AAA') ? 'bg-green-500 text-white' :
                                  companyData.grade?.includes('AA') ? 'bg-blue-500 text-white' :
                                  companyData.grade?.includes('B') ? 'bg-red-500 text-white' :
                                  'bg-gray-500 text-white'
                                }>
                                  {companyData.grade || 'N/A'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="text-center">
                              <p className="text-sm text-gray-600 mb-2">
                                {companyData.status === 'audited' ? 'Audit Complete' : 
                                 companyData.status === 'active' ? 'Ready for Audit' : 
                                 'Status'}
                              </p>
                              <Progress 
                                value={companyData.status === 'audited' ? 100 : 
                                       companyData.status === 'active' ? 50 : 0} 
                                className="h-2"
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                {companyData.status === 'audited' ? 'Company has been audited and settled' : 
                                 companyData.status === 'active' ? 'Ready for Phase 2 audit' : 
                                 'Company status unknown'}
                              </p>
                            </div>
                            
                            <Alert className="bg-blue-50 border-blue-200">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-700">
                                {companyData.status === 'active' 
                                  ? 'This company is ready for Phase 2 audit. Upload their actual consumption report.'
                                  : companyData.status === 'audited'
                                  ? 'This company has already been audited. You can audit them again with new data.'
                                  : 'Company status needs verification.'}
                              </AlertDescription>
                            </Alert>

                            <div className="text-center">
                              <Button 
                                onClick={() => {
                                  const auditTab = document.querySelector('[data-value="audit"]');
                                  if (auditTab) auditTab.click();
                                }}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                                disabled={companyData.status === 'audited'}
                              >
                                {companyData.status === 'audited' ? 'Already Audited' : 'Proceed to Audit'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileCheck className="h-6 w-6" />
                  Upload Audit Report
                </CardTitle>
                <CardDescription>
                  Upload the verified consumption report for blockchain settlement
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-8">
                {!companyData ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Please search and select a company first from the "Search Company" tab.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Blockchain Configuration Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Blockchain Configuration (For Testing)
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="rpcUrl">RPC URL *</Label>
                          <Input
                            id="rpcUrl"
                            value={rpcUrl}
                            onChange={(e) => setRpcUrl(e.target.value)}
                            placeholder="http://127.0.0.1:8545"
                            className="mt-1"
                            disabled={processing}
                          />
                          <p className="text-xs text-gray-500 mt-1">Local Hardhat node RPC URL</p>
                        </div>
                        
                        <div>
                          <Label htmlFor="contractAddress">Contract Address *</Label>
                          <Input
                            id="contractAddress"
                            value={contractAddress}
                            onChange={(e) => setContractAddress(e.target.value)}
                            placeholder="0x..."
                            className="mt-1"
                            disabled={processing}
                          />
                          <p className="text-xs text-gray-500 mt-1">CarbonToken contract address</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="privateKey">Company Private Key *</Label>
                        <div className="relative mt-1">
                          <Key className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <Input
                            id="privateKey"
                            type={showPrivateKey ? "text" : "password"}
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                            placeholder="Enter your wallet private key (0x...)"
                            className="pl-10"
                            disabled={processing}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPrivateKey(!showPrivateKey)}
                            className="absolute right-2 top-2 h-8 w-8 p-0"
                          >
                            {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            Required for blockchain transactions
                          </p>
                          {privateKey && !isValidPrivateKey(privateKey) && (
                            <p className="text-xs text-red-600">Invalid private key format</p>
                          )}
                        </div>
                      </div>

                      <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-700">
                          ⚠️ WARNING: Never share your private key. This is for testing only. 
                          In production, use MetaMask or a secure wallet provider.
                        </AlertDescription>
                      </Alert>
                    </div>

                    {/* Current Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-500 mb-2">Allowance</p>
                            <p className="text-3xl font-bold text-green-700">{companyData.initial_allowance || 0} tons</p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-500 mb-2">Previous Audit</p>
                            <p className="text-3xl font-bold text-blue-700">{companyData.last_verified_consumption || 0} tons</p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-500 mb-2">Status</p>
                            <Badge className="bg-purple-100 text-purple-800 text-lg px-4 py-1">
                              {(companyData.status || 'UNKNOWN').toUpperCase()}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* File Upload */}
                    <div>
                      <Label className="text-lg">Upload Actual Consumption Report (PDF) *</Label>
                      
                      {/* Hidden file input */}
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="auditReport"
                        disabled={processing}
                      />
                      
                      {/* Clickable upload area */}
                      <div 
                        className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                          processing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        } ${
                          dragOver 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                        }`}
                        onClick={processing ? null : handleFileButtonClick}
                        onDragOver={processing ? null : handleDragOver}
                        onDragLeave={processing ? null : handleDragLeave}
                        onDrop={processing ? null : handleDrop}
                      >
                        {file ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-center gap-3">
                              <CheckCircle className="h-12 w-12 text-green-500" />
                              <div className="text-left">
                                <p className="font-medium text-gray-900">{file.name}</p>
                                <p className="text-sm text-gray-500">
                                  {(file.size / 1024).toFixed(2)} KB
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile();
                              }}
                              className="mt-2"
                              disabled={processing}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Remove File
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">
                              Click to upload or drag and drop
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileButtonClick();
                              }}
                              disabled={processing}
                            >
                              Choose File
                            </Button>
                            <p className="text-xs text-gray-500 mt-4">
                              PDF files only • Max 10MB
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {processing && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Processing Audit...</span>
                          <span className="font-bold">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Extracting consumption data...</span>
                          <span>Settling credits...</span>
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {error && (
                      <Alert variant="destructive" className="animate-in slide-in-from-top duration-300">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="font-medium">{error}</AlertDescription>
                      </Alert>
                    )}

                    {/* Penalty Warning */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          View Penalty System Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Penalty System</DialogTitle>
                          <DialogDescription>
                            How penalties are calculated for exceeding carbon allowance
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-4 bg-yellow-50 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important: 1.5x Penalty Multiplier</h4>
                            <p className="text-yellow-700 text-sm">
                              Companies that exceed their allowance incur a 1.5x penalty on the excess amount.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold">Example Calculation:</h4>
                            <div className="text-sm space-y-1">
                              <p>• Allowance: 1000 tons</p>
                              <p>• Actual Consumption: 1100 tons</p>
                              <p>• Excess: 100 tons</p>
                              <p>• Penalty: 100 × 1.5 = 150 tons</p>
                              <p>• Total to Burn: 1100 + 150 = 1250 tons</p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Action Buttons */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <Button 
                        onClick={handleAuditSubmit}
                        disabled={!file || processing || !privateKey || !isValidPrivateKey(privateKey)}
                        className="flex-1 h-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      >
                        {processing ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing Audit...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Process Audit via Backend
                          </div>
                        )}
                      </Button>

                      <Button 
                        onClick={handleDirectRetire}
                        disabled={processing || !privateKey || !isValidPrivateKey(privateKey) || companyData.status === 'audited'}
                        variant="outline"
                        className="flex-1 h-12 text-lg border-purple-600 text-purple-600 hover:bg-purple-50"
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5" />
                          Direct Blockchain Retirement
                        </div>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Audit Results */}
            {auditResult && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-gray-50 to-purple-50 animate-in slide-in-from-right duration-500">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <FileCheck className="h-6 w-6" />
                    Audit Results
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-6">
                    {/* Status Alert */}
                    <Alert className={
                      auditResult.blockchain_status === 'SUCCESS' 
                        ? 'bg-green-50 border-green-200' 
                        : auditResult.status === 'DEFICIT'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }>
                      {auditResult.blockchain_status === 'SUCCESS' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertTitle className={
                        auditResult.blockchain_status === 'SUCCESS' ? 'text-green-700' : 
                        auditResult.status === 'DEFICIT' ? 'text-red-700' : 'text-yellow-700'
                      }>
                        {auditResult.status === 'DEFICIT' ? 'DEFICIT DETECTED' : 
                         auditResult.blockchain_status === 'SUCCESS' ? 'SETTLEMENT SUCCESSFUL' : 
                         'AUDIT COMPLETE'}
                      </AlertTitle>
                      <AlertDescription className={
                        auditResult.blockchain_status === 'SUCCESS' ? 'text-green-700' : 
                        auditResult.status === 'DEFICIT' ? 'text-red-700' : 'text-yellow-700'
                      }>
                        {auditResult.message || 'Audit processing complete'}
                      </AlertDescription>
                    </Alert>

                    {/* Results Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Actual Consumption</p>
                          <p className="text-2xl font-bold text-gray-900">{auditResult.actualConsumption || companyData.last_verified_consumption || 0} tons</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Penalty Applied</p>
                          <p className="text-2xl font-bold text-red-700">
                            {auditResult.penaltyApplied ? `${auditResult.penaltyTons?.toFixed(1) || 'Calculating'} tons` : 'None'}
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Total to Burn</p>
                          <p className="text-2xl font-bold text-orange-700">
                            {auditResult.totalRetirement?.toFixed(1) || auditResult.required_burn || 'Calculating'} tons
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className={
                        auditResult.surplus >= 0 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }>
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Net Surplus/Deficit</p>
                          <p className={`text-2xl font-bold ${
                            auditResult.surplus >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {auditResult.surplus >= 0 ? '+' : ''}{auditResult.surplus?.toFixed(1) || auditResult.net_surplus || 0} tons
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Blockchain Info */}
                    {auditResult.blockchain_tx && auditResult.blockchain_tx !== 'AWAITING_FUNDS' && auditResult.blockchain_tx !== 'null' && (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-500 mb-2">Transaction Hash</p>
                              <div className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                                {auditResult.blockchain_tx}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(auditResult.blockchain_tx);
                                  alert('Transaction hash copied to clipboard!');
                                }}
                              >
                                Copy
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => window.open(`https://sepolia.etherscan.io/tx/${auditResult.blockchain_tx}`, '_blank')}
                              >
                                View on Explorer
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Deficit Actions */}
                    {auditResult.surplus < 0 && (
                      <Card className="bg-red-50 border-red-200">
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <TrendingDown className="h-8 w-8 text-red-600" />
                              <div>
                                <h3 className="font-bold text-red-800">Credit Deficit Detected</h3>
                                <p className="text-red-700 text-sm">
                                  Company needs to purchase {Math.abs(auditResult.surplus).toFixed(1)} tons of carbon credits
                                </p>
                              </div>
                            </div>
                            <Button 
                              onClick={handleBuyCredits}
                              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 gap-2"
                            >
                              <DollarSign className="h-4 w-4" />
                              Buy Credits from Market
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Summary */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-900">Audit Summary</h3>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0">
                            ✓
                          </div>
                          <span>Company: {auditResult.company || companyData.company}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0">
                            📊
                          </div>
                          <span>Blockchain Status: {auditResult.blockchain_status || auditResult.status}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center flex-shrink-0">
                            ⚖️
                          </div>
                          <span>Net Result: {auditResult.surplus >= 0 ? 'Surplus' : 'Deficit'} of {Math.abs(auditResult.surplus).toFixed(1)} tons</span>
                        </li>
                        {auditResult.blockchain_tx && auditResult.blockchain_tx !== 'AWAITING_FUNDS' && auditResult.blockchain_tx !== 'null' && (
                          <li className="flex items-start gap-2">
                            <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center flex-shrink-0">
                              🔗
                            </div>
                            <span>Transaction completed on blockchain</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Audit;