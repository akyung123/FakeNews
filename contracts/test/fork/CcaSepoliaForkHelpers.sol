// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";

import {CcaLib} from "../../src/cca/CcaLib.sol";
import {MigratorParameters} from "../../src/cca/CcaTypes.sol";
import {IDistributorFactory} from "../../src/cca/ICca.sol";
import {ProphecyToken} from "../../src/ProphecyToken.sol";

address constant CCA_FACTORY = 0x000000001F26a0044BaA66024e7b6599c61963F8;
address constant LBP_STRATEGY = 0x95434E898Af471945Cab33D5064d2aC1A6Ba2000;
address constant INITIALIZER_HOOK = 0x1600059B95A80d500fC42400ea9a88A9C29D2000;
address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
address constant SEPOLIA_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
address constant SEPOLIA_UNIVERSAL_ROUTER = 0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3;
address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

string constant PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

interface ILbpStrategyFork {
    function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt)
        external;
    function migrate(address initializer) external;
    function initializerFactory() external view returns (address);
    function poolManager() external view returns (address);
    function positionManager() external view returns (address);
}

interface ICcaFork {
    error NotGraduated();
    /// Official CCA v2.1.0: `exitBid` when `maxPrice == clearing`.
    /// https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol
    error CannotExitBid();

    function submitBid(
        uint256 maxPriceQ96,
        uint128 amount,
        address owner,
        uint256 prevTickPriceQ96,
        bytes calldata hookData
    ) external payable returns (uint256 bidId);

    function checkpoint() external;
    function clearingPrice() external view returns (uint256);
    function isGraduated() external view returns (bool);
    function exitBid(uint256 bidId) external;
    function claimTokens(uint256 bidId) external;
    function sweepUnsoldTokens() external;
    function startBlock() external view returns (uint64);
    function endBlock() external view returns (uint64);
    function claimBlock() external view returns (uint64);
    function lastCheckpointedBlock() external view returns (uint64);
    function token() external view returns (address);
    function currency() external view returns (address);
    function totalSupply() external view returns (uint128);
    function tokensRecipient() external view returns (address);
    function fundsRecipient() external view returns (address);
}

interface IInitializerHookView {
    function authorized() external view returns (address);
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// Official LBP/CCA on a Sepolia fork, using Launchpad CcaLib 50/50 constants.
abstract contract CcaSepoliaForkBase is Test {
    ILbpStrategyFork internal strategy = ILbpStrategyFork(LBP_STRATEGY);
    IDistributorFactory internal factory = IDistributorFactory(CCA_FACTORY);

    address internal protocol = address(0xFEE);
    address internal lpRecipient = address(0x10C);
    address internal bidder = address(0xA11);

    bool internal forked;
    uint256 internal forkBlock;

    receive() external payable {}

    function _rpcUrl() internal view returns (string memory) {
        return vm.envOr("SEPOLIA_RPC_URL", PUBLIC_SEPOLIA_RPC);
    }

    function _pinBlock() internal view returns (uint256) {
        return vm.envOr("SEPOLIA_FORK_BLOCK", uint256(0));
    }

    function _forkAt(string memory rpc, uint256 pin) external {
        vm.createSelectFork(rpc, pin);
    }

    function _forkLatest(string memory rpc) external {
        vm.createSelectFork(rpc);
    }

    function _forkHasCode() internal view returns (bool) {
        return CCA_FACTORY.code.length > 0 && LBP_STRATEGY.code.length > 0 && INITIALIZER_HOOK.code.length > 0;
    }

    /// Pin `SEPOLIA_FORK_BLOCK` when set; otherwise latest. Public RPCs drop old
    /// historical state, so a stale pin must not fail the suite.
    function _maybeFork() internal returns (bool) {
        string memory rpc = _rpcUrl();
        uint256 pin = _pinBlock();
        if (pin != 0) {
            try this._forkAt(rpc, pin) {
                if (_forkHasCode()) {
                    forked = true;
                    forkBlock = pin;
                    return true;
                }
            } catch {}
        }
        try this._forkLatest(rpc) {
            if (_forkHasCode()) {
                forked = true;
                forkBlock = block.number;
                return true;
            }
        } catch {}
        return false;
    }

    modifier onFork() {
        if (!forked) vm.skip(true);
        _;
    }

    function _poolKey(address token) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(token),
            fee: CcaLib.POOL_FEE,
            tickSpacing: CcaLib.POOL_TICK_SPACING,
            hooks: IHooks(INITIALIZER_HOOK)
        });
    }

    function _createAuction(uint64 auctionBlocks, string memory label)
        internal
        returns (ICcaFork auction, ProphecyToken token)
    {
        token = new ProphecyToken(label, "PROP", address(this));
        token.approve(LBP_STRATEGY, CcaLib.TOTAL_SUPPLY);
        (bytes memory configData, bytes memory initializerParams, MigratorParameters memory mp) = CcaLib.build(
            address(token),
            LBP_STRATEGY,
            protocol,
            lpRecipient,
            INITIALIZER_HOOK,
            auctionBlocks,
            uint64(block.number)
        );
        bytes32 salt = keccak256(abi.encodePacked("prophecy-cca-42", label, auctionBlocks, block.number));
        address predicted = factory.getAddress(
            address(token), CcaLib.AUCTION_SUPPLY, initializerParams, keccak256(abi.encode(salt, mp)), LBP_STRATEGY
        );
        strategy.initializeDistribution(address(token), CcaLib.TOTAL_SUPPLY, configData, salt);
        auction = ICcaFork(predicted);
        assertTrue(address(auction).code.length > 0, "auction");
        assertEq(token.balanceOf(address(auction)), CcaLib.AUCTION_SUPPLY);
        assertEq(token.balanceOf(LBP_STRATEGY), CcaLib.LP_SUPPLY);
        assertEq(uint256(auction.endBlock() - auction.startBlock()), uint256(auctionBlocks));
    }

    function _bid(ICcaFork auction, uint128 amount, uint256 maxPrice) internal returns (uint256 bidId) {
        vm.deal(bidder, uint256(amount) + 1 ether);
        vm.prank(bidder);
        bidId = auction.submitBid{value: amount}(maxPrice, amount, bidder, CcaLib.FLOOR_PRICE_Q96, "");
    }

    function _rollTo(uint64 target) internal {
        if (block.number < target) vm.roll(target);
    }

    function _exitClaim(ICcaFork auction, ProphecyToken token, uint256 bidId, bool doCheckpoint)
        internal
        returns (uint256 refunded, uint256 filled)
    {
        if (doCheckpoint) auction.checkpoint();
        uint256 ethBefore = bidder.balance;
        uint256 tokBefore = token.balanceOf(bidder);
        vm.prank(bidder);
        auction.exitBid(bidId);
        refunded = bidder.balance - ethBefore;
        _rollTo(auction.claimBlock());
        auction.claimTokens(bidId);
        filled = token.balanceOf(bidder) - tokBefore;
    }
}
