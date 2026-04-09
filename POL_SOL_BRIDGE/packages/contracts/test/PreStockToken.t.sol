// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PreStockToken} from "../src/PreStockToken.sol";

contract PreStockTokenTest is Test {
    PreStockToken public token;

    address public owner = makeAddr("owner");
    address public nttManager = makeAddr("nttManager");
    address public user = makeAddr("user");
    address public recipient = makeAddr("recipient");

    function setUp() public {
        vm.prank(owner);
        token = new PreStockToken("Vaulted Prestock SpaceX", "vSPACEX", owner);
    }

    function test_InitialState() public view {
        assertEq(token.name(), "Vaulted Prestock SpaceX");
        assertEq(token.symbol(), "vSPACEX");
        assertEq(token.decimals(), 8);
        assertEq(token.owner(), owner);
        assertEq(token.nttManager(), address(0));
        assertEq(token.totalSupply(), 0);
    }

    function test_SetNttManager() public {
        vm.prank(owner);
        token.setNttManager(nttManager);

        assertEq(token.nttManager(), nttManager);
    }

    function test_SetNttManager_EmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit PreStockToken.NttManagerSet(address(0), nttManager);
        token.setNttManager(nttManager);
    }

    function test_SetNttManager_RevertIfNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        token.setNttManager(nttManager);
    }

    function test_SetNttManager_RevertIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PreStockToken.InvalidNttManager.selector);
        token.setNttManager(address(0));
    }

    function test_Mint() public {
        vm.prank(owner);
        token.setNttManager(nttManager);

        vm.prank(nttManager);
        token.mint(recipient, 1000e8);

        assertEq(token.balanceOf(recipient), 1000e8);
        assertEq(token.totalSupply(), 1000e8);
    }

    function test_Mint_RevertIfNotNttManager() public {
        vm.prank(owner);
        token.setNttManager(nttManager);

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(PreStockToken.OnlyNttManager.selector, user, nttManager)
        );
        token.mint(recipient, 1000e8);
    }

    function test_Mint_RevertIfNoNttManagerSet() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(PreStockToken.OnlyNttManager.selector, user, address(0))
        );
        token.mint(recipient, 1000e8);
    }

    function test_Burn() public {
        // Setup: mint tokens first
        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, 1000e8);

        // User burns their tokens
        vm.prank(user);
        token.burn(400e8);

        assertEq(token.balanceOf(user), 600e8);
        assertEq(token.totalSupply(), 600e8);
    }

    function test_BurnFrom() public {
        // Setup: mint tokens first
        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, 1000e8);

        // User approves recipient to burn
        vm.prank(user);
        token.approve(recipient, 300e8);

        // Recipient burns from user
        vm.prank(recipient);
        token.burnFrom(user, 300e8);

        assertEq(token.balanceOf(user), 700e8);
    }

    function test_Pause() public {
        // Setup: mint tokens first
        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, 1000e8);

        // Owner pauses
        vm.prank(owner);
        token.pause();

        // Transfer should fail
        vm.prank(user);
        vm.expectRevert();
        token.transfer(recipient, 100e8);
    }

    function test_Unpause() public {
        // Setup: mint tokens first
        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, 1000e8);

        // Pause then unpause
        vm.prank(owner);
        token.pause();
        vm.prank(owner);
        token.unpause();

        // Transfer should succeed
        vm.prank(user);
        token.transfer(recipient, 100e8);

        assertEq(token.balanceOf(recipient), 100e8);
    }

    function test_Pause_RevertIfNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        token.pause();
    }

    function test_Transfer() public {
        // Setup
        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, 1000e8);

        // Transfer
        vm.prank(user);
        token.transfer(recipient, 250e8);

        assertEq(token.balanceOf(user), 750e8);
        assertEq(token.balanceOf(recipient), 250e8);
    }

    function testFuzz_Mint(uint256 amount) public {
        vm.assume(amount < type(uint128).max); // Reasonable bound

        vm.prank(owner);
        token.setNttManager(nttManager);

        vm.prank(nttManager);
        token.mint(recipient, amount);

        assertEq(token.balanceOf(recipient), amount);
    }

    function testFuzz_BurnAmount(uint256 mintAmount, uint256 burnAmount) public {
        vm.assume(mintAmount < type(uint128).max);
        vm.assume(burnAmount <= mintAmount);

        vm.prank(owner);
        token.setNttManager(nttManager);
        vm.prank(nttManager);
        token.mint(user, mintAmount);

        vm.prank(user);
        token.burn(burnAmount);

        assertEq(token.balanceOf(user), mintAmount - burnAmount);
    }
}
