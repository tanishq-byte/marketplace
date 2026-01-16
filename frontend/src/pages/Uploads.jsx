import React, { useState } from 'react';
import { Upload, Building, Wallet, FileText, ArrowRight, CheckCircle, AlertCircle, XCircle, FileWarning } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Uploads = () => {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

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
      setError('Please enter a valid Ethereum wallet address (0x...)');
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
    formData.append('file', file); // Make sure this matches backend expectation
    
    // According to your backend, it expects 'wallet_address' as a query parameter, not form data
    // But let's also add it to FormData in case it's needed
    
    console.log('Submitting with:', {
      companyName,
      walletAddress,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    try {
      const response = await fetch(`http://localhost:8000/phase1-minting/${encodeURIComponent(companyName)}?wallet_address=${encodeURIComponent(walletAddress)}`, {
        method: 'POST',
        body: formData,
        // IMPORTANT: Do NOT set Content-Type header for FormData
        // The browser will set it automatically with boundary
      });
      
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
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
        // Try to get detailed error message
        let errorMessage = `Upload failed (${response.status}): `;
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            errorMessage += data.detail.map(d => d.msg).join(', ');
          } else {
            errorMessage += data.detail;
          }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center gap-3">
            <Upload className="h-10 w-10 text-green-600" />
            Initial Carbon Allowance Minting
          </h1>
          <p className="text-gray-600 text-lg">
            Upload your carbon report to receive equivalent carbon credits as tokens
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Form */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Building className="h-6 w-6" />
                Company Information
              </CardTitle>
              <CardDescription>
                Enter your company details and upload the carbon report PDF
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName" className="text-base">
                      Company Name *
                    </Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                      className="mt-1 h-12"
                      required
                      disabled={isUploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="walletAddress" className="text-base">
                      Wallet Address *
                    </Label>
                    <div className="flex items-center mt-1">
                      <Wallet className="h-5 w-5 text-gray-400 ml-3 absolute" />
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
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      Must be a valid Ethereum address (42 characters starting with 0x)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="carbonReport" className="text-base">
                      Carbon Report (PDF) *
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
                            PDF files only • Max 10MB
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
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Debug Info - Remove in production */}
                {process.env.NODE_ENV === 'development' && file && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <FileWarning className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 text-sm">
                      Debug: File ready - {file.name} ({file.size} bytes)
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={isUploading || !file || !companyName || !walletAddress}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Mint Carbon Credits
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </Button>

                {isUploading && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Uploading & Processing</span>
                      <span className="font-bold">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Extracting carbon data...</span>
                      <span>Minting tokens...</span>
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
                <CardTitle className="text-2xl">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      step: 1,
                      title: 'Upload Report',
                      description: 'Upload your certified carbon emissions report in PDF format'
                    },
                    {
                      step: 2,
                      title: 'OCR Processing',
                      description: 'Our system extracts carbon tonnage using advanced OCR'
                    },
                    {
                      step: 3,
                      title: 'Token Minting',
                      description: 'Equivalent carbon credits are minted as ERC20 tokens'
                    },
                    {
                      step: 4,
                      title: 'Wallet Allocation',
                      description: 'Tokens are transferred to your provided wallet address'
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-bold">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
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
                    Minting Successful!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Company</p>
                        <p className="font-semibold text-lg">{result.company}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Carbon Allowance</p>
                        <p className="font-semibold text-lg text-green-700">{result.tons} tons</p>
                      </div>
                    </div>
                    {result.blockchain_tx && result.blockchain_tx !== 'null' && (
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-500 mb-2">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm bg-gray-100 p-2 rounded flex-1 truncate">
                            {result.blockchain_tx}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(result.blockchain_tx);
                              // You could add a toast notification here
                              alert('Transaction hash copied to clipboard!');
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        {result.tons} carbon credits have been minted to your wallet. You can now trade them on the marketplace.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Next Steps:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">1</span>
                          </div>
                          <span>Monitor your carbon credits in the Dashboard</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">2</span>
                          </div>
                          <span>Trade surplus credits on the Marketplace</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">3</span>
                          </div>
                          <span>Submit audit reports during settlement phase</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">4</span>
                          </div>
                          <span>Track your reputation score on the Leaderboard</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Instructions Card */}
            {!result && !isUploading && (
              <Card className="shadow-lg border-0 border-l-4 border-green-500">
                <CardHeader>
                  <CardTitle className="text-xl text-green-800">
                    📋 Preparation Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>Have your company's legal name ready</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>Ensure you have a Web3 wallet address (MetaMask, etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>Prepare your carbon report in PDF format</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span>Make sure carbon tonnage is clearly stated in the report</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Uploads;