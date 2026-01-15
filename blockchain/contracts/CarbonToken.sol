// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CarbonToken is ERC20, Ownable {
    constructor() ERC20("CarbonCredit", "CCT") Ownable(msg.sender) {}

    // THIS IS THE EDIT: Change decimals from 18 to 0
    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    function mintCredits(address company, uint256 amount) public onlyOwner {
        // Now 'amount' 750 will mean exactly 750 tokens
        _mint(company, amount);
    }

    function retireCredits(address company, uint256 amount) public onlyOwner {
        _burn(company, amount);
    }

    mapping(address => uint256) public reputationScore;

// Function to update score after Phase 2
function updateReputation(address _company, uint256 _newScore) external onlyOwner {
    reputationScore[_company] = _newScore;
}
    function tradeCredits(address _to, uint256 _amount) public {
    require(balanceOf(msg.sender) >= _amount, "Insufficient credits to sell");
    _transfer(msg.sender, _to, _amount);
}
    mapping(address => uint256) public listings;
uint256 public totalMarketSupply;

function listForSale(uint256 _amount) public {
    require(balanceOf(msg.sender) >= _amount, "Not enough credits");
    _transfer(msg.sender, address(this), _amount); // Move to Escrow
    listings[msg.sender] += _amount;
    totalMarketSupply += _amount;
}

function buyFromMarket(uint256 _amount) public {
    require(totalMarketSupply >= _amount, "Market supply too low");
    // Logic to loop through sellers and distribute credits goes here
    _transfer(address(this), msg.sender, _amount);
    totalMarketSupply -= _amount;
}
}