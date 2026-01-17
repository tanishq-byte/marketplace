import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CarbonABI from '../abis/CarbonToken.json';

const CONTRACT_ADDRESS = "0x8b38F7d3da2c4A3eDA5c7d5873B4236ca916d0b0";

const Marketplace = () => {
    const [account, setAccount] = useState("");
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState("0");

    // Form States
    const [listAmount, setListAmount] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [listQr, setListQr] = useState(""); 

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setAccount(accounts[0]);
                fetchData();
            } catch (err) { console.error("Connection failed", err); }
        } else { alert("Please install MetaMask!"); }
    };

    const getContract = async (withSigner = false) => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        if (withSigner) {
            const signer = await provider.getSigner();
            return new ethers.Contract(CONTRACT_ADDRESS, CarbonABI.abi, signer);
        }
        return new ethers.Contract(CONTRACT_ADDRESS, CarbonABI.abi, provider);
    };

    const fetchData = async () => {
        try {
            const contract = await getContract();
            if (account) {
                const bal = await contract.balanceOf(account);
                setBalance(bal.toString());
            }
            const nextId = await contract.nextListingId();
            let activeOnes = [];
            for (let i = 0; i < nextId; i++) {
                const item = await contract.marketListings(i);
                if (item.active) activeOnes.push(item);
            }
            setListings(activeOnes);
        } catch (err) { console.error("Fetch error", err); }
    };

    // --- DEMO ONLY: Mint Credits for Twitch Logistics ---
    const handleMintDemo = async () => {
        try {
            setLoading(true);
            const contract = await getContract(true);
            const tx = await contract.mintCredits(account, 500);
            await tx.wait();
            alert("500 CCT Minted for Twitch Logistics!");
            fetchData();
        } catch (err) { alert("Only Owner can mint credits!",err); }
        finally { setLoading(false); }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) setListQr(URL.createObjectURL(file)); 
    };

    const handleCreateListing = async (e) => {
        e.preventDefault();
        console.log("Triggering listWithPrice...");
        try {
            setLoading(true);
            const contract = await getContract(true);
            // Convert strings to BigInt for safe math
            const tx = await contract.listWithPrice(
                BigInt(listAmount), 
                BigInt(listPrice), 
                listQr
            );
            console.log("Tx Sent:", tx.hash);
            await tx.wait();
            alert("Credits Locked in Escrow!");
            fetchData();
        } catch (err) { 
            console.error("Listing Failed:", err);
            alert("Error: " + (err.reason || "Check console"));
        } finally { setLoading(false); }
    };

    const handleMarkPaid = async (id) => {
        const contract = await getContract(true);
        const tx = await contract.markAsPaid(id);
        await tx.wait();
        fetchData();
    };

    const handleRelease = async (id) => {
        const contract = await getContract(true);
        const tx = await contract.releaseTokens(id, account); 
        await tx.wait();
        alert("Transaction Settled!");
        fetchData();
    };

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", (accs) => setAccount(accs[0] || ""));
        }
        fetchData();
    }, [account]);

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-10 max-w-6xl mx-auto">
                <div>
                    <h1 className="text-3xl font-extrabold text-green-800">Carbon Exchange</h1>
                    {account && <p className="text-sm text-gray-500">Twitch Logistics Balance: <span className="font-bold text-green-600">{balance} CCT</span></p>}
                </div>
                <div className="flex gap-4">
                    <button onClick={handleMintDemo} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Demo: Mint 500 CCT</button>
                    <button onClick={connectWallet} className={`px-6 py-2 rounded-full font-bold shadow-sm ${account ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white'}`}>
                        {account ? `Connected: ${account.slice(0,6)}...` : "Connect Wallet"}
                    </button>
                </div>
            </div>

            {/* Registration Summary for Demo */}
            <div className="max-w-4xl mx-auto mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded text-sm text-blue-800">
                <strong>Demo Context:</strong> Registering <strong>Twitch Logistics Pvt Ltd</strong> (TL-2026-X99). Use the Mint button above to simulate administrative credit allocation.
            </div>

            <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-12">
                <h2 className="text-xl font-bold mb-4 text-gray-700">List Your Credits</h2>
                <form onSubmit={handleCreateListing} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">CCT AMOUNT</label>
                        <input type="number" placeholder="0" className="w-full border p-2 rounded-lg" required onChange={(e) => setListAmount(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">PRICE (₹)</label>
                        <input type="number" placeholder="0" className="w-full border p-2 rounded-lg" required onChange={(e) => setListPrice(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">UPI QR IMAGE</label>
                        <input type="file" accept="image/*" className="text-xs" required onChange={handleImageUpload} />
                    </div>
                    <button type="submit" disabled={!account || loading} className="bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-200">
                        {loading ? "Processing..." : "List in Escrow"}
                    </button>
                </form>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {listings.map((l) => {
                    const isSeller = account.toLowerCase() === l.seller.toLowerCase();
                    return (
                        <div key={l.id.toString()} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between mb-4">
                                <span className="font-bold text-gray-400">#00{l.id.toString()}</span>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${l.isPaid ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {l.isPaid ? 'Payment Done' : 'Available'}
                                </span>
                            </div>
                            <img src={l.qrCodeUrl} className="w-full h-48 object-contain bg-gray-50 rounded-xl mb-4 p-2 border" alt="UPI QR" />
                            <div className="flex justify-between mb-6 border-t pt-4">
                                <div><p className="text-xs text-gray-400">Credits</p><p className="font-bold">{l.amount.toString()} CCT</p></div>
                                <div className="text-right"><p className="text-xs text-gray-400">Price</p><p className="font-bold text-green-600">₹{l.pricePerToken.toString()}</p></div>
                            </div>
                            {l.isPaid ? (
                                isSeller ? (
                                    <button onClick={() => handleRelease(l.id)} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600">Verify & Release</button>
                                ) : (
                                    <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed">Awaiting Release</button>
                                )
                            ) : (
                                !isSeller && <button onClick={() => handleMarkPaid(l.id)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Mark as Paid</button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Marketplace;