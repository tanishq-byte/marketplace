import React, { useState } from 'react';
import { Upload, Building, Wallet, FileText, ArrowRight, CheckCircle, AlertCircle, XCircle, FileWarning, ExternalLink, Copy, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const Uploads = () => {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  const API_BASE = 'http://localhost:8000';

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
    const fileInput = document.getElementById('carbonReport');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!companyName || !walletAddress || !file) {
      setError('Please fill all fields and upload a PDF');
      return;
    }

    // Validate wallet address format (basic Ethereum address check)
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum wallet address (0x followed by 40 hex characters)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);
    setError('');
    
    // Start progress simulation
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90; // Hold at 90% until API completes
        }
        return prev + 10;
      });
    }, 300);
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Call the updated backend endpoint with correct parameters
      const response = await fetch(
        `${API_BASE}/phase1-minting/${encodeURIComponent(companyName)}?wallet_address=${encodeURIComponent(walletAddress)}`, 
        {
          method: 'POST',
          body: formData,
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
        setUploadProgress(100);
        
        // Clear form on success
        setCompanyName('');
        setWalletAddress('');
        setFile(null);
        const fileInput = document.getElementById('carbonReport');
        if (fileInput) fileInput.value = '';
      } else {
        // Handle error response
        let errorMessage = 'Upload failed: ';
        if (data.detail) {
          errorMessage += data.detail;
        } else if (data.message) {
          errorMessage += data.message;
        } else {
          errorMessage += 'Unknown error';
        }
        setError(errorMessage);
        setUploadProgress(0);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Network error: ${err.message}. Please check your connection and try again.`);
      setUploadProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
    }
  };

  const handleFileButtonClick = () => {
    document.getElementById('carbonReport').click();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // In a real app, use a toast notification here
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center gap-3">
                <Upload className="h-10 w-10 text-green-600" />
                Phase 1: Company Registration & Minting
              </h1>
              <p className="text-gray-600 text-lg">
                Upload your carbon report to receive equivalent carbon credits (CCT tokens)
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
              <Info className="h-4 w-4 mr-2" />
              OCR Processing Enabled
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Form */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Building className="h-6 w-6" />
                Company Registration
              </CardTitle>
              <CardDescription>
                Register your company and mint initial carbon credits based on your carbon report
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {/* Company Name */}
                  <div>
                    <Label htmlFor="companyName" className="text-base">
                      Company Name *
                    </Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter exact company name"
                      className="mt-1 h-12"
                      required
                      disabled={isUploading}
                    />
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      Use the same name for Phase 2 audit
                    </p>
                  </div>

                  {/* Wallet Address */}
                  <div>
                    <Label htmlFor="walletAddress" className="text-base">
                      Ethereum Wallet Address *
                    </Label>
                    <div className="relative mt-1">
                      <Wallet className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        id="walletAddress"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x1234..."
                        className="h-12 pl-10"
                        required
                        disabled={isUploading}
                        pattern="^0x[a-fA-F0-9]{40}$"
                        title="Enter a valid Ethereum address (0x followed by 40 hex characters)"
                      />
                      {walletAddress && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowWallet(!showWallet)}
                          className="absolute right-2 top-2 h-8 w-8 p-0"
                        >
                          {showWallet ? 'Hide' : 'Show'}
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500 ml-1">
                        Must be a valid Ethereum address
                      </p>
                      {walletAddress && !showWallet && (
                        <p className="text-xs text-gray-600 font-mono">
                          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <Label htmlFor="carbonReport" className="text-base">
                      Carbon Emission Report (PDF) *
                    </Label>
                    
                    {/* Hidden file input */}
                    <Input
                      id="carbonReport"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                      required
                      disabled={isUploading}
                    />
                    
                    {/* Clickable upload area */}
                    <div 
                      className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                        isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        dragOver 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                      }`}
                      onClick={isUploading ? null : handleFileButtonClick}
                      onDragOver={isUploading ? null : handleDragOver}
                      onDragLeave={isUploading ? null : handleDragLeave}
                      onDrop={isUploading ? null : handleDrop}
                    >
                      {file ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-3">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{file.name}</p>
                              <p className="text-sm text-gray-500">
                                {(file.size / 1024).toFixed(2)} KB • PDF Document
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
                            disabled={isUploading}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Remove File
                          </Button>
                        </div>
                      ) : (
                        <>
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
                            disabled={isUploading}
                          >
                            Choose File
                          </Button>
                          <p className="text-xs text-gray-500 mt-4">
                            PDF files only • Max 10MB • Ensure carbon values are visible
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive" className="animate-in slide-in-from-top duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md"
                  disabled={isUploading || !file || !companyName || !walletAddress}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing & Minting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Register Company & Mint Tokens
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </Button>

                {isUploading && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Processing Report...</span>
                      <span className="font-bold">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Extracting carbon data via OCR...</span>
                      <span>Minting tokens on blockchain...</span>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Right Column: Process & Result */}
          <div className="space-y-8">
            {/* Process Steps */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Info className="h-6 w-6" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      step: 1,
                      title: 'Upload Report',
                      description: 'Upload certified carbon emissions PDF. Our OCR extracts tonnage.',
                      status: file ? '✓ Complete' : 'Pending'
                    },
                    {
                      step: 2,
                      title: 'Company Registration',
                      description: 'Company registered in database with wallet address.',
                      status: companyName && walletAddress ? '✓ Ready' : 'Pending'
                    },
                    {
                      step: 3,
                      title: 'Token Minting',
                      description: 'Admin mints CCT tokens to your wallet on blockchain.',
                      status: result ? '✓ Complete' : 'Pending'
                    },
                    {
                      step: 4,
                      title: 'Phase 2 Ready',
                      description: 'Ready for audit & settlement in Phase 2.',
                      status: result ? '✓ Ready' : 'Not Started'
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                        item.status.includes('✓') 
                          ? 'bg-green-100 text-green-800' 
                          : item.status.includes('Ready') 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          <span className={`text-xs font-medium ${
                            item.status.includes('✓') 
                              ? 'text-green-600' 
                              : item.status.includes('Ready') 
                              ? 'text-blue-600'
                              : 'text-gray-500'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Results Display */}
            {result && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50 animate-in slide-in-from-right duration-500">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-6 w-6" />
                    Registration & Minting Successful!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Company</p>
                          <p className="text-xl font-bold text-gray-900">{result.company}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-500 mb-2">Tokens Minted</p>
                          <p className="text-xl font-bold text-green-700">{result.tons_allocated || result.tons} CCT</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Transaction Details */}
                    {result.blockchain_tx && result.blockchain_tx !== 'null' && (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700">Blockchain Transaction</p>
                            <Badge className="bg-green-100 text-green-800">Confirmed</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm bg-gray-100 p-3 rounded flex-1 truncate">
                              {result.blockchain_tx}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(result.blockchain_tx)}
                                className="h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`https://sepolia.etherscan.io/tx/0x${result.blockchain_tx}`, '_blank')}
                                className="h-8 w-8 p-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Transaction hash for minting {result.tons_allocated || result.tons} CCT tokens
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Success Alert */}
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Registration Complete</AlertTitle>
                      <AlertDescription className="text-green-700">
                        {result.tons_allocated || result.tons} carbon credits (CCT) have been minted to your wallet. 
                        You can now proceed to Phase 2 audit when ready.
                      </AlertDescription>
                    </Alert>
                    
                    {/* Next Steps */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Next Steps:</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            1
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Monitor Your Dashboard</p>
                            <p className="text-sm text-gray-600">Track your carbon credits and reputation score</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            2
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Trade on Marketplace</p>
                            <p className="text-sm text-gray-600">Buy/sell surplus credits with other companies</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            3
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Phase 2 Audit</p>
                            <p className="text-sm text-gray-600">Submit actual consumption report for settlement</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            4
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Leaderboard Ranking</p>
                            <p className="text-sm text-gray-600">Improve your environmental reputation grade</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => window.location.href = '/audit'}
                      >
                        Go to Phase 2 Audit
                      </Button>
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => window.location.href = '/marketplace'}
                      >
                        Visit Marketplace
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Instructions Card - Show when no result */}
            {!result && !isUploading && (
              <Card className="shadow-lg border-0 border-l-4 border-green-500">
                <CardHeader>
                  <CardTitle className="text-xl text-green-800 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Important Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        !
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Use Consistent Information</p>
                        <p className="text-sm text-gray-600">Use the same company name and wallet for Phase 2</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        !
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Report Quality</p>
                        <p className="text-sm text-gray-600">Ensure carbon values are clearly visible in PDF for OCR</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        !
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Token Safety</p>
                        <p className="text-sm text-gray-600">Tokens are minted to your provided wallet address</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        !
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">1.5x Penalty System</p>
                        <p className="text-sm text-gray-600">Phase 2 audit applies 1.5x penalty for overconsumption</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer Note */}
        {!result && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need help? Ensure your PDF clearly displays carbon tonnage values (e.g., "500 tons", "250 tCO2e")
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Uploads;