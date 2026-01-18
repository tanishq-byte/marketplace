import React, { useState, useEffect, use } from 'react';
import { ethers } from 'ethers';
import CarbonABI from '../pages/abi.js';
import { 
  ShoppingCart, Lock, Eye, EyeOff, 
  CheckCircle, RefreshCw, AlertTriangle, 
  Wallet, ArrowRightLeft, Building2, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Marketplace = () => {
    // Connection & Profile States
    const [account, setAccount] = useState("");
    const [balance, setBalance] = useState("0");
    const [privateKey, setPrivateKey] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [dbCompanyData, setDbCompanyData] = useState(null); // Full data from /leaderboard
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    
    // UI & Data States
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Create Listing Form States
    const [listAmount, setListAmount] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [listQrUrl, setListQrUrl] = useState("");

    const CONTRACT_ADDRESS = "0x8b38F7d3da2c4A3eDA5c7d5873B4236ca916d0b0";
    const RPC_URL = "http://127.0.0.1:8545";
    const API_BASE = "http://localhost:8000";

    // 1. Fetch Company Data from Leaderboard API
    const fetchCompanyDataFromDB = async (walletAddr) => {
        try {
            const res = await fetch(`${API_BASE}/leaderboard`);
            const data = await res.json();
            
            if (data.leaderboard) {
                // Match by wallet address (case-insensitive)
                const company = data.leaderboard.find(c => 
                    c.wallet_address.toLowerCase() === walletAddr.toLowerCase()
                );
                
                if (company) {
                    setDbCompanyData(company);
                    return company;
                } else {
                    console.warn("Wallet not found in database. Ensure Phase 1 is complete.");
                    return null;
                }
            }
        } catch (err) {
            console.error("Failed to fetch leaderboard data", err);
        }
    };

    // 2. Connect logic: Derives address and then fetches DB data
    const handleConnect = async () => {
        if (!privateKey || !companyName) {
            setError("Enter Company Name and Private Key first!");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const wallet = new ethers.Wallet(privateKey, provider);
            const derivedAddress = wallet.address;
            
            setAccount(derivedAddress);
            
            // Fetch DB Truth
            await fetchCompanyDataFromDB(derivedAddress);
            
            // Fetch Blockchain Truth
            await refreshMarketData(derivedAddress);
            
            setSuccess(`Session Established for ${companyName}`);
        } catch (err) {
            setError("Auth failed. Check your Private Key.");
        } finally {
            setLoading(false);
        }
    };

    const refreshMarketData = async (userAddr) => {
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CarbonABI, provider);
            
            if (userAddr) {
                const bal = await contract.balanceOf(userAddr);
                setBalance(bal.toString());
            }

            const res = await fetch(`${API_BASE}/marketplace/listings`);
            const data = await res.json();
            console.log("Fetched Listings:", data.listings);
            if (data.status === "SUCCESS") {
                setListings(data.listings);
            }
        } catch (err) {
            console.error("Refresh error:", err);
        }
    };

    useEffect(() => {
        refreshMarketData(account);
    }, []);

    const handleCreateListing = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const url = `${API_BASE}/marketplace/list-with-price?company_name=${encodeURIComponent(companyName)}&amount=${listAmount}&price=${listPrice}&qr_url=${encodeURIComponent(listQrUrl)}`;
            const res = await fetch(url, { method: 'POST' });
            const data = await res.json();

            if (data.status === "LISTED") {
                setSuccess(`Listed ${listAmount} CCT Successfully`);
                setListAmount(""); setListPrice(""); setListQrUrl("");
                await handleConnect(); // Re-fetch all data
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError("Listing error. Check console.");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/marketplace/mark-paid/${id}?buyer_company=${encodeURIComponent(companyName)}`, { method: 'POST' });
            const data = await res.json();
            if (data.status === "MARKED_PAID") {
                setSuccess("Payment confirmed on-chain.");
                await refreshMarketData(account);
            }
        } catch (err) { setError("Mark paid failed."); }
        finally { setLoading(false); }
    };

    const handleRelease = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/marketplace/release/${id}?buyer_wallet=${account}`, { method: 'POST' });
            const data = await res.json();
            if (data.status === "RELEASED") {
                setSuccess("Tokens transferred to buyer wallet.");
                await handleConnect();
            }
        } catch (err) { setError("Release failed."); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Auth Section */}
                <Card className="shadow-md border-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-indigo-700">
                            <Lock className="h-5 w-5"/> Terminal Access
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Verify Company Name (Phase 1 Name)</Label>
                                <Input placeholder="e.g. TESLA" value={companyName} onChange={(e) => setCompanyName(e.target.value.toUpperCase())} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label>Private Key</Label>
                                <Input type={showPrivateKey ? "text" : "password"} placeholder="0x..." value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} />
                                <Button variant="ghost" size="sm" className="absolute right-0 bottom-0" onClick={() => setShowPrivateKey(!showPrivateKey)}>
                                    {showPrivateKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </Button>
                            </div>
                        </div>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleConnect} disabled={loading}>
                            {loading ? <RefreshCw className="animate-spin mr-2"/> : "Fetch Data & Connect"}
                        </Button>
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                        {success && <Alert className="bg-green-50 text-green-700 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}
                    </CardContent>
                </Card>

                {/* Company Data Profile Card */}
                {dbCompanyData && (
                    <Card className="bg-white border-l-4 border-indigo-500 shadow-sm animate-in fade-in duration-500">
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 size={12}/> DB Identity</p>
                                    <p className="font-bold text-gray-900">{dbCompanyData.company}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck size={12}/> Rep Grade</p>
                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">{dbCompanyData.grade}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500">DB Allowance</p>
                                    <p className="font-bold text-green-600">{dbCompanyData.initial_allowance} CCT</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Wallet Status</p>
                                    <p className="text-[10px] font-mono truncate text-gray-400">{account}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="browse" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-gray-100 p-1">
                        <TabsTrigger value="browse">Marketplace</TabsTrigger>
                        <TabsTrigger value="create">List Credits</TabsTrigger>
                    </TabsList>

                    <TabsContent value="browse" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {listings.length === 0 ? (
                            <div className="col-span-3 text-center py-20 text-gray-400 border-2 border-dashed rounded-xl">No active listings in escrow.</div>
                        ) : (
                            listings.map((l) => (
                                <Card key={l.listing_id} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all group">
                                    <div className={`h-1.5 w-full ${l.is_paid ? 'bg-orange-400' : 'bg-green-400'}`} />
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Badge variant="outline" className="text-[10px]">ID #{l.listing_id}</Badge>
                                            <Badge className={l.is_paid ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}>
                                                {l.is_paid ? "Paid" : "Available"}
                                            </Badge>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-gray-800">{l.seller_company}</h3>
                                            <p className="text-3xl font-black text-indigo-600">{l.amount} <span className="text-sm font-normal text-gray-400">CCT</span></p>
                                            <p className="text-sm font-medium text-gray-500">₹{l.price_per_token} per credit</p>
                                        </div>

                                        {l.qr_url && (
                                            <div className="border-2 border-gray-50 rounded-lg p-2 bg-gray-50 flex justify-center">
                                                <img src={l.qr_url} alt="QR" className="h-32 w-32 object-contain mix-blend-multiply" />
                                            </div>
                                        )}

                                        <div className="pt-4 border-t space-y-2">
                                            {!l.is_paid && l.seller_company !== companyName && (
                                                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleMarkPaid(l.listing_id)}>Mark as Paid</Button>
                                            )}
                                            {l.is_paid && l.seller_company === companyName && (
                                                <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => handleRelease(l.listing_id)}>Release Tokens</Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="create">
                        <Card className="max-w-2xl mx-auto border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle>New Escrow Listing</CardTitle>
                                <CardDescription>Tokens will be locked in the smart contract until buyer pays.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateListing} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Amount (CCT)</Label>
                                            <Input type="number" placeholder="0" value={listAmount} onChange={(e)=>setListAmount(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Price (₹)</Label>
                                            <Input type="number" placeholder="0" value={listPrice} onChange={(e)=>setListPrice(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Payment QR Link</Label>
                                        <Input placeholder="https://gateway.pinata.cloud/ipfs/..." value={listQrUrl} onChange={(e)=>setListQrUrl(e.target.value)} required />
                                    </div>
                                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-12" disabled={loading || !account}>
                                        {loading ? "Confirming on Blockchain..." : "Authorize Escrow Listing"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Marketplace;