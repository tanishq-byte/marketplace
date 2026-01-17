// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CarbonToken is ERC20, Ownable {
    
    struct Listing {
        uint256 id;
        address seller;
        uint256 amount;
        uint256 pricePerToken; // Price in INR or preferred currency
        string qrCodeUrl;      // Path/URL to the uploaded QR image
        bool isPaid;           // Flagged when buyer clicks "Mark as Paid"
        bool active;           // True while in escrow
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public marketListings;
    
    // Tracking active listings for frontend discovery
    uint256[] public activeListingIds;

    constructor() ERC20("CarbonCredit", "CCT") Ownable(msg.sender) {}

    function decimals() public view virtual override returns (uint8) { return 0; }

    // --- ADMIN FUNCTIONS ---
    function mintCredits(address company, uint256 amount) public onlyOwner { _mint(company, amount); }

    // --- DYNAMIC MARKETPLACE LOGIC ---

    /**
     * @notice Tesla/Seller locks tokens in escrow with a specific price and QR code.
     */
    function listWithPrice(uint256 _amount, uint256 _price, string memory _qrUrl) public {
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
        
        // Move tokens to the contract (Escrow Lock)
        _transfer(msg.sender, address(this), _amount); 

        marketListings[nextListingId] = Listing({
            id: nextListingId,
            seller: msg.sender,
            amount: _amount,
            pricePerToken: _price,
            qrCodeUrl: _qrUrl,
            isPaid: false,
            active: true
        });

        activeListingIds.push(nextListingId);
        nextListingId++;
    }

    /**
     * @notice Rivian/Buyer signals they have scanned the QR and paid via UPI.
     */
    function markAsPaid(uint256 _listingId) public {
        require(marketListings[_listingId].active, "Listing not active");
        marketListings[_listingId].isPaid = true;
    }

    /**
     * @notice Seller verifies bank account and releases the tokens to the buyer.
     */
    function releaseTokens(uint256 _listingId, address _buyer) public {
        Listing storage listing = marketListings[_listingId];
        require(msg.sender == listing.seller, "Only seller can release");
        require(listing.isPaid, "Buyer has not marked as paid");
        require(listing.active, "Already settled");

        listing.active = false;
        _transfer(address(this), _buyer, listing.amount); // Tokens go to Buyer
    }
    /**
 * @notice Phase 2 Settlement: Companies "retire" credits to offset their footprint.
 * This permanently removes the tokens from circulation.
 */
function retireCredits(uint256 _amount) public {
    require(balanceOf(msg.sender) >= _amount, "Insufficient credits to retire");
    _burn(msg.sender, _amount); // Uses OpenZeppelin's internal burn function
}
}