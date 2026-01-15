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
}