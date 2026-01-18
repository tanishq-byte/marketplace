import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CarbonABI from '../pages/abi.js'; // Updated import path
import { 
  ShoppingCart, DollarSign, Lock, Eye, EyeOff, Upload, 
  CheckCircle, XCircle, ExternalLink, Copy, RefreshCw, 
  AlertTriangle, Key, Building, Wallet, QrCode,
  ArrowRightLeft, Shield, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Marketplace = () => {
    const [account, setAccount] = useState("");
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState("0");
    const [privateKey, setPrivateKey] = useState("");
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [backendListings, setBackendListings] = useState([]);
    const [activeTab, setActiveTab] = useState("marketplace");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form States
    const [listAmount, setListAmount] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [listQrUrl, setListQrUrl] = useState("");
    const [qrFile, setQrFile] = useState(null);
    const [qrPreview, setQrPreview] = useState("");

    // Configuration
    const CONTRACT_ADDRESS = "0x8b38F7d3da2c4A3eDA5c7d5873B4236ca916d0b0";
    const RPC_URL = "http://127.0.0.1:8545";
    const API_BASE = "http://localhost:8000";

    // Connect with private key instead of MetaMask
    const connectWithPrivateKey = async () => {
        if (!privateKey) {
            setError("Please enter your private key");
            return;
        }

        if (!isValidPrivateKey(privateKey)) {
            setError("Invalid private key format");
            return;
        }

        setLoading(true);
        setError("");
        
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const wallet = new ethers.Wallet(privateKey, provider);
            setAccount(wallet.address);
            
            // Fetch initial data
            await fetchBlockchainData(wallet.address);
            await fetchBackendData();
            
            setSuccess(`Connected as ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);
        } catch (err) {
            console.error("Connection failed:", err);
            setError(`Connection failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const isValidPrivateKey = (key) => {
        return key.length === 64 || (key.startsWith('0x') && key.length === 66);
    };

    // Get contract instance
    const getContract = async (withSigner = false) => {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        if (withSigner && privateKey) {
            const wallet = new ethers.Wallet(privateKey, provider);
            return new ethers.Contract(CONTRACT_ADDRESS, CarbonABI, wallet);
        }
        return new ethers.Contract(CONTRACT_ADDRESS, CarbonABI, provider);
    };

    // Fetch blockchain data
    const fetchBlockchainData = async (walletAddress) => {
        try {
            const contract = await getContract();
            if (walletAddress) {
                const bal = await contract.balanceOf(walletAddress);
                setBalance(bal.toString());
            }
            
            // Fetch listings from blockchain
            const nextId = await contract.nextListingId();
            let activeListings = [];
            for (let i = 0; i < nextId; i++) {
                try {
                    const item = await contract.marketListings(i);
                    if (item.active) {
                        activeListings.push({
                            id: i,
                            seller: item.seller,
                            amount: item.amount.toString(),
                            pricePerToken: item.pricePerToken.toString(),
                            qrCodeUrl: item.qrCodeUrl,
                            isPaid: item.isPaid,
                            active: item.active
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching listing ${i}:`, err);
                }
            }
            setListings(activeListings);
        } catch (err) {
            console.error("Blockchain fetch error:", err);
            setError(`Failed to fetch blockchain data: ${err.message}`);
        }
    };

    // Fetch backend data (companies and marketplace listings)
    const fetchBackendData = async () => {
        try {
            // Fetch companies from leaderboard
            const companiesRes = await fetch(`${API_BASE}/leaderboard`);
            if (companiesRes.ok) {
                const data = await companiesRes.json();
                setCompanies(data.leaderboard || []);
            }

            // Fetch marketplace listings from backend API
            const listingsRes = await fetch(`${API_BASE}/marketplace/listings`);
            if (listingsRes.ok) {
                const data = await listingsRes.json();
                if (data.status === "SUCCESS") {
                    setBackendListings(data.listings || []);
                }
            }
        } catch (err) {
            console.error("Backend fetch error:", err);
            setError(`Failed to fetch backend data: ${err.message}`);
        }
    };

    // Create listing using backend API
    const handleCreateListing = async (e) => {
        e.preventDefault();
        
        if (!privateKey || !isValidPrivateKey(privateKey)) {
            setError("Please enter a valid private key");
            return;
        }

        if (!companyName) {
            setError("Please select a company");
            return;
        }

        if (!listAmount || !listPrice || !listQrUrl) {
            setError("Please fill all required fields");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            // First, check if we need to upload QR image
            let finalQrUrl = listQrUrl;
            
            if (qrFile) {
                // In a real app, upload to a CDN and get URL
                // For demo, create a data URL
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Image = e.target.result;
                    finalQrUrl = base64Image;
                    await createBackendListing(base64Image);
                };
                reader.readAsDataURL(qrFile);
            } else {
                await createBackendListing(finalQrUrl);
            }
        } catch (err) {
            console.error("Listing creation error:", err);
            setError(`Failed to create listing: ${err.message}`);
            setLoading(false);
        }
    };

    const createBackendListing = async (qrUrl) => {
        try {
            // Call backend API
            const response = await fetch(`${API_BASE}/marketplace/list-with-price?company_name=${encodeURIComponent(companyName)}&amount=${listAmount}&price=${listPrice}&qr_url=${encodeURIComponent(qrUrl)}`, {
                method: 'POST',
            });

            const data = await response.json();
            
            if (response.ok && data.status === "LISTED") {
                setSuccess(`Successfully listed ${listAmount} CCT at ₹${listPrice} each`);
                
                // Clear form
                setListAmount("");
                setListPrice("");
                setListQrUrl("");
                setQrFile(null);
                setQrPreview("");
                
                // Refresh data
                await fetchBackendData();
                await fetchBlockchainData(account);
            } else {
                setError(data.message || "Failed to create listing");
            }
        } catch (err) {
            setError(`API Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Mark as paid using backend API
    const handleMarkPaid = async (listingId) => {
        if (!privateKey || !isValidPrivateKey(privateKey)) {
            setError("Please enter a valid private key");
            return;
        }

        if (!companyName) {
            setError("Please select a company");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE}/marketplace/mark-paid/${listingId}?buyer_company=${encodeURIComponent(companyName)}`, {
                method: 'POST',
            });

            const data = await response.json();
            
            if (response.ok && data.status === "MARKED_PAID") {
                setSuccess(`Successfully marked listing #${listingId} as paid`);
                await fetchBackendData();
                await fetchBlockchainData(account);
            } else {
                setError(data.message || "Failed to mark as paid");
            }
        } catch (err) {
            setError(`API Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Release tokens using backend API
    const handleRelease = async (listingId) => {
        if (!privateKey || !isValidPrivateKey(privateKey)) {
            setError("Please enter a valid private key");
            return;
        }

        if (!account) {
            setError("Please connect first");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE}/marketplace/release/${listingId}?buyer_wallet=${encodeURIComponent(account)}`, {
                method: 'POST',
            });

            const data = await response.json();
            
            if (response.ok && data.status === "RELEASED") {
                setSuccess(`Successfully released tokens for listing #${listingId}`);
                await fetchBackendData();
                await fetchBlockchainData(account);
            } else {
                setError(data.message || "Failed to release tokens");
            }
        } catch (err) {
            setError(`API Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Mint credits (admin function) - direct blockchain call
    const handleMintCredits = async () => {
        if (!privateKey || !isValidPrivateKey(privateKey)) {
            setError("Please enter a valid private key");
            return;
        }

        if (!account) {
            setError("Please connect first");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const contract = await getContract(true);
            const tx = await contract.mintCredits(account, 500);
            await tx.wait();
            
            setSuccess("500 CCT minted successfully!");
            await fetchBlockchainData(account);
        } catch (err) {
            console.error("Minting error:", err);
            setError(`Minting failed: ${err.reason || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleQrUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setQrFile(file);
            const previewUrl = URL.createObjectURL(file);
            setQrPreview(previewUrl);
            setListQrUrl(previewUrl); // Use preview URL for demo
        }
    };

    const removeQrImage = () => {
        setQrFile(null);
        setQrPreview("");
        setListQrUrl("");
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess("Copied to clipboard!");
        setTimeout(() => setSuccess(""), 2000);
    };

    useEffect(() => {
        if (account) {
            fetchBlockchainData(account);
            fetchBackendData();
        }
    }, [account]);

    // Combine blockchain and backend listings
    const allListings = [...listings, ...backendListings].filter((listing, index, self) =>
        index === self.findIndex((l) => l.id === listing.id)
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center gap-3">
                                <ShoppingCart className="h-10 w-10 text-green-600" />
                                Carbon Credit Marketplace
                            </h1>
                            <p className="text-gray-600 text-lg">
                                Trade carbon credits securely with escrow protection
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {account && (
                                <Badge className="bg-green-100 text-green-800">
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Balance: {balance} CCT
                                </Badge>
                            )}
                            <Button 
                                onClick={() => fetchBackendData() && fetchBlockchainData(account)}
                                variant="outline"
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Connection Section */}
                    <Card className="mb-8 border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                Connect to Blockchain
                            </CardTitle>
                            <CardDescription>
                                Enter your private key to interact with the marketplace
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="companySelect">Company Name *</Label>
                                        <Select onValueChange={setCompanyName} value={companyName}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Select your company" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {companies.map((company) => (
                                                    <SelectItem key={company.company} value={company.company}>
                                                        {company.company} ({company.grade})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <Label htmlFor="privateKey">Private Key *</Label>
                                        <div className="relative mt-1">
                                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <Input
                                                id="privateKey"
                                                type={showPrivateKey ? "text" : "password"}
                                                value={privateKey}
                                                onChange={(e) => setPrivateKey(e.target.value)}
                                                placeholder="Enter your wallet private key (0x...)"
                                                className="pl-10"
                                                disabled={loading}
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
                                </div>

                                {error && (
                                    <Alert variant="destructive" className="animate-in slide-in-from-top">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                {success && (
                                    <Alert className="bg-green-50 border-green-200 animate-in slide-in-from-top">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-700">{success}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-4">
                                    <Button 
                                        onClick={connectWithPrivateKey}
                                        disabled={loading || !privateKey || !isValidPrivateKey(privateKey) || !companyName}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Connecting...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Wallet className="h-4 w-4" />
                                                {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
                                            </div>
                                        )}
                                    </Button>

                                    <Button 
                                        onClick={handleMintCredits}
                                        variant="outline"
                                        disabled={loading || !account}
                                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                    >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Mint Demo Credits (500 CCT)
                                    </Button>
                                </div>

                                <Alert className="bg-red-50 border-red-200">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        ⚠️ WARNING: This is for testing only. Never share your private key in production.
                                        Use MetaMask or secure wallet connections in real applications.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="marketplace">Active Listings</TabsTrigger>
                        <TabsTrigger value="create">Create Listing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="marketplace" className="space-y-6">
                        {allListings.length === 0 ? (
                            <Card className="border-0 shadow-lg">
                                <CardContent className="pt-12 pb-12 text-center">
                                    <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Listings</h3>
                                    <p className="text-gray-500 mb-6">
                                        There are no carbon credits available for trading right now.
                                    </p>
                                    <Button onClick={() => setActiveTab("create")}>
                                        Create First Listing
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {allListings.map((listing) => {
                                        const isSeller = account?.toLowerCase() === listing.seller?.toLowerCase();
                                        const sellerCompany = companies.find(c => 
                                            c.wallet_address?.toLowerCase() === listing.seller?.toLowerCase()
                                        );

                                        return (
                                            <Card key={listing.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                                                <CardContent className="p-6">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <Badge className="mb-2 bg-blue-100 text-blue-800">
                                                                #{listing.id.toString().padStart(3, '0')}
                                                            </Badge>
                                                            <p className="text-sm text-gray-500">
                                                                Seller: {sellerCompany?.company || "Unknown Company"}
                                                            </p>
                                                        </div>
                                                        <Badge className={
                                                            listing.isPaid 
                                                                ? 'bg-orange-100 text-orange-800' 
                                                                : 'bg-green-100 text-green-800'
                                                        }>
                                                            {listing.isPaid ? 'Payment Confirmed' : 'Available'}
                                                        </Badge>
                                                    </div>

                                                    {listing.qrCodeUrl && (
                                                        <div className="mb-4">
                                                            <img 
                                                                src={listing.qrCodeUrl} 
                                                                alt="Payment QR Code" 
                                                                className="w-full h-48 object-contain bg-gray-50 rounded-lg border p-2"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="space-y-3 mb-6">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Credits:</span>
                                                            <span className="font-bold text-lg">{listing.amount} CCT</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Price per token:</span>
                                                            <span className="font-bold text-green-600 text-lg">₹{listing.pricePerToken}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center border-t pt-3">
                                                            <span className="text-gray-600">Total Value:</span>
                                                            <span className="font-bold text-xl">
                                                                ₹{parseInt(listing.amount) * parseInt(listing.pricePerToken)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {listing.isPaid ? (
                                                            isSeller ? (
                                                                <Button 
                                                                    onClick={() => handleRelease(listing.id)}
                                                                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600"
                                                                    disabled={loading || !account}
                                                                >
                                                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                                    Verify & Release Tokens
                                                                </Button>
                                                            ) : (
                                                                <Button disabled className="w-full bg-gray-100 text-gray-400">
                                                                    Awaiting Seller Release
                                                                </Button>
                                                            )
                                                        ) : (
                                                            !isSeller && (
                                                                <Button 
                                                                    onClick={() => handleMarkPaid(listing.id)}
                                                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                                                                    disabled={loading || !account}
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Mark as Paid
                                                                </Button>
                                                            )
                                                        )}

                                                        {isSeller && !listing.isPaid && (
                                                            <Button variant="outline" className="w-full" disabled>
                                                                Your Listing - Waiting for Buyer
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>

                                <Card className="border-0 shadow-lg bg-gradient-to-r from-gray-50 to-blue-50">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <Shield className="h-8 w-8 text-blue-600" />
                                                <div>
                                                    <h3 className="font-bold text-gray-900">Escrow Protection</h3>
                                                    <p className="text-gray-600 text-sm">
                                                        All transactions are secured by smart contract escrow
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-green-600" />
                                                <span className="font-bold text-green-700">
                                                    {allListings.reduce((sum, l) => sum + parseInt(l.amount), 0)} CCT Available
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="create" className="space-y-6">
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-2xl flex items-center gap-2">
                                    <Upload className="h-6 w-6" />
                                    List Carbon Credits for Sale
                                </CardTitle>
                                <CardDescription>
                                    Lock your carbon credits in escrow with a price and QR code
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateListing} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <Label htmlFor="listAmount">Amount (CCT) *</Label>
                                            <Input
                                                id="listAmount"
                                                type="number"
                                                value={listAmount}
                                                onChange={(e) => setListAmount(e.target.value)}
                                                placeholder="e.g., 100"
                                                className="mt-1 h-12"
                                                min="1"
                                                required
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                How many carbon credits to list
                                            </p>
                                        </div>

                                        <div>
                                            <Label htmlFor="listPrice">Price per Token (₹) *</Label>
                                            <Input
                                                id="listPrice"
                                                type="number"
                                                value={listPrice}
                                                onChange={(e) => setListPrice(e.target.value)}
                                                placeholder="e.g., 50"
                                                className="mt-1 h-12"
                                                min="1"
                                                required
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Price in Indian Rupees per CCT
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="qrUrl">QR Code URL *</Label>
                                        <Input
                                            id="qrUrl"
                                            type="text"
                                            value={listQrUrl}
                                            onChange={(e) => setListQrUrl(e.target.value)}
                                            placeholder="https://upi.me/your-upi-id"
                                            className="mt-1 h-12"
                                            required
                                            disabled={loading}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            URL to your UPI QR code for payment
                                        </p>
                                    </div>

                                    <div>
                                        <Label className="text-base">Or Upload QR Code Image</Label>
                                        
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleQrUpload}
                                            className="hidden"
                                            id="qrUpload"
                                            disabled={loading}
                                        />
                                        
                                        <div className="mt-2">
                                            {qrPreview ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <img 
                                                            src={qrPreview} 
                                                            alt="QR Preview" 
                                                            className="w-32 h-32 object-contain border rounded-lg"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-gray-900">QR Code Preview</p>
                                                            <p className="text-sm text-gray-500">
                                                                {qrFile?.name || "Uploaded image"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={removeQrImage}
                                                        disabled={loading}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Remove Image
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => document.getElementById('qrUpload').click()}
                                                >
                                                    <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                                    <p className="text-gray-600 mb-2">
                                                        Click to upload QR code image
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        PNG, JPG, or WebP • Max 5MB
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="w-full">
                                                <AlertTriangle className="h-4 w-4 mr-2" />
                                                View Escrow Process
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>How Marketplace Escrow Works</DialogTitle>
                                                <DialogDescription>
                                                    Secure P2P carbon credit trading process
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            1
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">Seller Lists Credits</p>
                                                            <p className="text-sm text-gray-600">Tokens are locked in smart contract escrow</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-6 w-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            2
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">Buyer Scans QR & Pays</p>
                                                            <p className="text-sm text-gray-600">Buyer makes off-chain payment and marks as paid</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-6 w-6 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            3
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">Seller Verifies Payment</p>
                                                            <p className="text-sm text-gray-600">Seller confirms payment and releases tokens</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            4
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">Tokens Transferred</p>
                                                            <p className="text-sm text-gray-600">Tokens move from escrow to buyer's wallet</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    <Button 
                                        type="submit"
                                        disabled={loading || !account || !companyName || !listAmount || !listPrice || !listQrUrl}
                                        className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Creating Listing...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <ShoppingCart className="h-5 w-5" />
                                                List Credits in Escrow
                                            </div>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg border-l-4 border-green-500">
                            <CardHeader>
                                <CardTitle className="text-xl text-green-800">
                                    Listing Requirements
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <span>You must have enough CCT balance to list</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <span>Provide a valid UPI QR code for payments</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <span>Tokens are locked in escrow until payment confirmed</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <span>You can cancel listing anytime before payment</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Footer Stats */}
                {account && (
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-2">Your Balance</p>
                                    <p className="text-2xl font-bold text-green-700">{balance} CCT</p>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border-0 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-2">Active Listings</p>
                                    <p className="text-2xl font-bold text-blue-700">{allListings.length}</p>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border-0 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-2">Total Available</p>
                                    <p className="text-2xl font-bold text-purple-700">
                                        {allListings.reduce((sum, l) => sum + parseInt(l.amount), 0)} CCT
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border-0 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-2">Your Company</p>
                                    <p className="text-xl font-bold text-gray-900 truncate">
                                        {companyName || "Not Selected"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Marketplace;