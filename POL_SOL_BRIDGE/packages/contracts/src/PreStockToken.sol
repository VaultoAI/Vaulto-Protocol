// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {INttToken} from "./interfaces/INttToken.sol";

/**
 * @title PreStockToken
 * @notice ERC-20 token for PreStock synthetic assets bridged via Wormhole NTT
 * @dev Implements INttToken interface for NTT Manager compatibility (burning mode)
 *
 * Key features:
 * - 8 decimals to match NTT sharedDecimals and Solana SPL tokens
 * - Mint function callable only by NTT Manager
 * - Burn function callable by token holders (for bridging back to Solana)
 * - Pausable for emergency situations
 */
contract PreStockToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, INttToken {
    /// @notice The NTT Manager contract address authorized to mint tokens
    address private _nttManager;

    /// @notice Number of decimals (matches Solana SPL tokens)
    uint8 private constant DECIMALS = 8;

    /// @notice Emitted when the NTT Manager address is updated
    event NttManagerSet(address indexed previousManager, address indexed newManager);

    /// @notice Error when caller is not the NTT Manager
    error OnlyNttManager(address caller, address expected);

    /// @notice Error when setting NTT Manager to zero address
    error InvalidNttManager();

    /**
     * @notice Constructor
     * @param name_ Token name (e.g., "PreStock SpaceX")
     * @param symbol_ Token symbol (e.g., "vSPACEX")
     * @param owner_ Initial owner address (should be multisig for mainnet)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {}

    /**
     * @notice Returns the number of decimals (8 to match Solana SPL tokens)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Get the current NTT Manager address
     * @return The address of the NTT Manager
     */
    function nttManager() public view override returns (address) {
        return _nttManager;
    }

    /**
     * @notice Set the NTT Manager address
     * @dev Only callable by the owner. The NTT Manager is authorized to mint tokens.
     * @param newNttManager The address of the NTT Manager contract
     */
    function setNttManager(address newNttManager) external override onlyOwner {
        if (newNttManager == address(0)) revert InvalidNttManager();

        address previousManager = _nttManager;
        _nttManager = newNttManager;

        emit NttManagerSet(previousManager, newNttManager);
    }

    /**
     * @notice Mint tokens to a recipient
     * @dev Only callable by the NTT Manager. Used when tokens are bridged from Solana.
     * @param recipient The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address recipient, uint256 amount) external override {
        if (msg.sender != _nttManager) {
            revert OnlyNttManager(msg.sender, _nttManager);
        }
        _mint(recipient, amount);
    }

    /**
     * @notice Pause all token transfers
     * @dev Only callable by the owner. For emergency use.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     * @dev Only callable by the owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Required override for ERC20Pausable
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, amount);
    }
}
