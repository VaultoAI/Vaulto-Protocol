// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INttToken
 * @notice Interface for tokens compatible with Wormhole NTT (Native Token Transfers)
 * @dev Tokens implementing this interface can be used with NTT Manager in burning mode
 */
interface INttToken {
    /**
     * @notice Mint tokens to a recipient
     * @dev Only callable by the NTT Manager
     * @param recipient The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address recipient, uint256 amount) external;

    /**
     * @notice Set the NTT Manager address that can mint tokens
     * @dev Only callable by the owner
     * @param nttManager The address of the NTT Manager contract
     */
    function setNttManager(address nttManager) external;

    /**
     * @notice Get the current NTT Manager address
     * @return The address of the NTT Manager
     */
    function nttManager() external view returns (address);
}
